# VPS collector review and refactoring proposal

Reviewed 2026-09-16. This records the initial review. The implementation and operational contracts are now documented in [collectors.md](collectors.md); verification below refers to the original review, not the subsequent refactor.

## Recommendation

Keep independently deployed services and standardize their structure and behavioral contracts first. Small duplicated lifecycle helpers are acceptable. Use Smart City's separation of normalization and persistence as the starting point, supplemented with Nextbike's explicit `poll_cycle`. Do not build an inheritance framework or a universal database writer.

The highest-value changes concern correctness during source and database failures, followed by consistent diagnostics and testability. File organization alone will not resolve those differences.

## Scope and current comparison

| Service | Acquisition and transformation | Persistence | Operational behavior |
| --- | --- | --- | --- |
| Smart City | Sequential HTTP dashboard requests; pure normalization; typed observations with source timestamps and skip reasons | Explicit transaction, timeouts, advisory lock, observation ledger, duplicate/revision handling; protects admin metadata | Validated dataclass settings; bounded HTTP response and request deadline; backoff, jitter, Retry-After; status file; once/dry-run/offline input |
| Nextbike | HTTP snapshot; separate typed normalizer; observation time assigned locally | Explicit transaction, timeouts, advisory lock; change-or-15-minute sampling; bike movement inference | Dataclass settings; health file; retries start at 2 seconds; no once/dry-run; no response-size limit |
| Traffic | Sequential HTTP requests for each road/category; fetch and parse combined | Row-by-row upserts, missing-incident resolution, corridor snapshots; manual commit on persistent connection | Pydantic settings; health file; fixed cadence; source errors swallowed; no once/dry-run |
| Shake | Per-station WebSocket streams, FDSN discovery, MiniSEED decoding and wall-clock flushing in one large module | API or direct SQL; opens a connection per flush; insertion errors logged and swallowed | Settings initialized at import; alternative settings implementations; reconnect loop; no collector healthcheck |
| Archive worker | Reads a database snapshot, streams rows into ZIP/CSV, uploads artifacts | Publishes archive catalogue after upload, checks visibility, attempts cleanup | Separate Node service; advisory lock, consistent DB snapshot, size-bounded parts; daily watch loop; no status contract |

The API receives pushed data and serves queries; it is not another external-source polling collector. No separate bus/train/waste polling daemons are present in this directory. The archive worker is an export pipeline and should remain distinct.

## Fix first

### 1. Traffic: failed fetches must not mean an empty road

Evidence: `traffic-collector/fetcher.py:162`, `traffic-collector/storage.py:73`, `traffic-collector/main.py:60`.

Non-200 responses and several fetch/parse errors are logged and skipped. The remaining list is persisted as if acquisition succeeded. With all endpoints unavailable, the collector can mark itself healthy, insert “clear” snapshots, and resolve older incidents after six minutes. Resolution is also unscoped: its SQL does not restrict source or configured roads.

Return explicit fetch outcomes containing source scope and completeness. The simplest safe first change is to fail the entire cycle if any required endpoint fails. A later improvement can ingest successful scopes independently, but only complete scopes may resolve missing incidents. Persist endpoint/category ownership if needed to establish that boundary. Do not infer “clear” from missing or invalid data.

Acceptance: total failure and partial endpoint failure never resolve unseen incidents or create clear snapshots for incomplete roads; a valid complete empty response still resolves incidents under the documented grace period.

### 2. Traffic: recover the database connection and transaction

Evidence: `traffic-collector/main.py:85` and `traffic-collector/storage.py:14`.

The inner loop catches every exception and retains the connection, while persistence commits only at the end. A SQL error can leave the transaction aborted; a broken connection can also remain trapped in that loop. Subsequent cycles keep failing without reaching the outer reconnect handler.

Use an explicit transaction for each persistence batch with automatic rollback. Let connection failures escape to reconnect logic. For these low-frequency pollers, opening a bounded connection after fetching is a simple consistent default; a persistent connection is fine only with explicit recovery.

Acceptance: after an injected SQL error, the next cycle succeeds; after connection loss, a new connection is acquired; no partially written cycle survives.

### 3. Shake: acknowledge a batch only after successful storage

Evidence: `shake-collector/main.py:166` and `shake-collector/main.py:242`.

Flushing clears the sample buffer before persistence, and both API and database write failures are swallowed. Those readings are lost without triggering a storage retry. Stream ingestion also waits for each write, and cancellation does not drain pending data.

Separate the stream reader, pure window aggregation, and writer with a bounded queue. Persistence must raise on failure. Keep a stable pending batch until acknowledged, retry it with the same identity, and define queue overflow and shutdown behavior. If surviving process crashes is required, use a bounded disk spool; an in-memory queue alone does not provide durability. Add destination deduplication before enabling retries because a timeout can occur after a successful commit. API mode needs an equivalent idempotency contract.

Acceptance: failed and ambiguously acknowledged writes can be replayed without loss or duplicates; queue growth is bounded; shutdown has a documented drain deadline and reports unflushed data.

### 4. Configuration should fail clearly before the daemon starts

Evidence: `traffic-collector/config.py:29`, `docker-compose.yml` (`TRAFFIC_ROADS`), `nextbike-collector/config.py:8`, `shake-collector/config.py`.

Traffic declares `roads: list[str]` but Compose passes `A67,A5,A6`, without a CSV parser. This appears incompatible with Pydantic Settings' normal JSON decoding for complex values; verify in the built image and use a JSON array or an explicit CSV settings source. Local runtime reproduction was blocked by missing `pydantic-settings`.

Nextbike silently ignores invalid city IDs. A wholly invalid value produces an empty filter and an unfiltered request. Reject invalid IDs, and require an explicit choice for collecting all cities. Shake's fallback and Pydantic implementations read different environment names; remove the fallback and validate the ingestion mode, positive window/retry values, and decimation factor.

Use one settings approach consistently (the existing frozen dataclass plus `from_env()` is sufficient), explicit service-prefixed environment names, and no import-time settings initialization. Use database keyword arguments instead of interpolated connection URLs in Traffic and Shake so credentials containing URI delimiters work correctly.

## Common structure, independently implemented

```text
<service>/
  main.py        # CLI, logging, resource lifecycle, scheduling, shutdown
  config.py      # settings parsing and validation
  source.py      # HTTP/stream protocol and raw payload acquisition
  normalize.py   # deterministic transformation; no network or SQL
  storage.py     # transaction, SQL/API writes, persistence statistics
  health.py      # atomic status writing and health evaluation
  tests/         # fixtures, parser tests, failure tests, DB integration
```

Use `models.py` only when model definitions become large enough to justify it. Shake may also need `windows.py` and `buffer.py`; the archive worker can keep its existing JavaScript modules.

The polling cycle should read as:

```text
fetch(client, settings) -> FetchResult
normalize(fetch_result, settings) -> NormalizedBatch
persist(connection, batch) -> IngestStats
record_status(after successful commit, including coverage and counts)
```

These are comparable local interfaces, not a requirement to import shared classes. Domain records remain different: incidents, source observations, bike snapshots, and waveform windows do not have the same semantics.

Every fetch result should distinguish a valid empty response, an invalid response, and an incomplete response. Record the source scope, acquisition time, and any source timestamp separately. Normalization should return accepted records and skip counts by reason. Invalid individual records may be skipped deliberately, but structural failure must not become a successful empty batch. For snapshot reconciliation, skipped records can make a scope incomplete.

Keep retry policy at the orchestration boundary so fetch, storage, and loop retries do not multiply each other. Use bounded timeouts, capped exponential backoff with jitter, and Retry-After where supplied. Classify transient failures separately from invalid configuration or incompatible schemas. Keep sleeps interruptible and avoid overlapping cycles. Nextbike's immediate two-second retry is currently faster than its normal one-minute polling interval.

## Align operational behavior

- Give pollers `--once`, `--dry-run`, `--input`, and `--healthcheck`. Dry-run must have no DB or state-file writes. For Shake, offer a bounded capture/replay window rather than treating an endless stream as a poll.
- Use a common status schema: last attempt, last successful commit, consecutive failures, error category, source coverage, fetched/accepted/skipped counts, inserted/updated/duplicate counts, phase durations, and latest source observation time. Preserve last-success information when an attempt fails.
- Distinguish process activity, acquisition success, successful persistence, and source-data freshness. A successful request returning stale data is different from fresh ingestion. Valid unchanged data should not be marked unhealthy merely because no row was inserted.
- Derive stale thresholds from configured cadence and expected source behavior. Nextbike's hard-coded 300-second threshold conflicts with its allowed polling interval of up to 3600 seconds; Traffic also uses a fixed threshold. Track Shake health per station so one healthy stream does not mask another stalled stream.
- Give status-file failures their own diagnostic category: a committed database batch must not be reported as rolled back because writing a local status file failed. Any replay still needs stable batch identity.
- Standardize the Python baseline, dependency constraints/lock strategy, Docker user, state directory, logging, and shutdown grace. Remove Traffic's unused curl installation if it stays unused. Add collector-local READMEs for Nextbike and Traffic.
- Make schema readiness explicit. Currently the API applies `schema.sql` at startup, logs initialization failures, and still exposes a static healthy response. A migration step plus a schema-version check in collectors is more reliable than relying on startup order alone.

## Preserve domain semantics while improving them

**Smart City:** retain source observation timestamps, revision tracking, replay protection, metric mapping checks, and preservation of admin metadata. Extract acquisition/status handling from `main.py`. Multi-dashboard fetching currently fails the whole cycle if any dashboard fails; keep that policy explicit initially. Later, bounded concurrency and independently tracked coverage can prevent one dashboard from blocking all the others, provided overlapping observations are still deduplicated and conflicting revisions handled consistently.

**Nextbike:** retain change-based sampling and the 15-minute heartbeat as an explicit domain policy. Name locally assigned times as acquisition/snapshot time; do not imply they came from the provider. A changed bike roster with an unchanged count is currently omitted from the availability observation until the heartbeat; decide whether roster history is required and compare/store it separately if so. Bikes are repeatedly set active but never made stale by this collector; add freshness-based availability, distinguishing “not recently observed” from “rented.” Station changes establish inferred movement, not proof of a customer trip. Deduplicate bike IDs across a snapshot before inferring moves. Preserve admin overrides instead of overwriting names/coordinates each poll.

**Traffic:** split parsing from HTTP calls. Remove fabricated fallback locations (`AS Lorsch` to `AD Viernheim`), and distinguish reported delay from estimated delay and unknown delay. Closures currently force at least 1800 seconds of delay, which then looks like a measured value. Carry endpoint/category information through normalization and deduplicate incident identities before counting snapshots. Use source start/end times when valid and available; otherwise label stored times as first/last observation. Test malformed geometries and items without letting one bad record silently turn the rest of a source into an authoritative empty snapshot.

**Shake:** aggregate in fixed source-time windows and timestamp the aggregate by a documented window boundary. Currently metrics are timestamped by flush time even though samples carry their own timestamps; reconnect overlap or backlog can distort window composition. Define late-sample and duplicate behavior, retain counts as the unit unless calibration is explicitly implemented, and expose sample coverage. Preserve independent station failure isolation. Reset reconnect backoff after a sustained healthy stream, not only when the streaming method returns normally.

**Archive worker:** preserve streaming, bounded parts, consistent snapshot reads, advisory locking, and publication only after uploads. Adopt comparable status/timing reporting and graceful shutdown. Separate retryable cleanup from export publication: failure deleting old files after publication currently aborts the remaining run, and old keys are no longer in the replaced catalogue. Persist pending cleanup for later retry. Its daily retry cadence is appropriate for scheduling new work but unnecessarily slow for transient failures. There is no reason to rewrite it in Python for visual consistency.

## Performance improvements, after correctness

1. Nextbike: fetch latest metric values for the current station batch in one query instead of four queries per station. Scope previous-bike reads to relevant IDs rather than reading the whole bike table. Batch writes while retaining transaction and movement semantics.
2. Smart City: upsert metadata and source information once per sensor per batch, rather than repeating that work for every metric. Batch ledger lookups only after preserving revision and ordering behavior in tests.
3. Traffic: use bounded concurrency across independent requests, then persist once. Group/deduplicate incidents by road once for corridor statistics. Partial-success handling must be fixed before concurrency is introduced.
4. Shake: reuse a bounded pool or managed connection for frequent five-second writes, with reconnect handling. A shared writer within the Shake process can batch stations without combining their source-time windows. Avoid an unbounded connection per station strategy.
5. Measure fetch/normalize/persist durations, SQL calls, rows per second, and queue depth before adding indexes or optimizing further. There is no measured throughput bottleneck established by this review.

## Shared code decision

Start with the same small local helpers copied into each Python service and a documented contract. That preserves the current Docker build boundaries and makes each service understandable in isolation.

Only consider a small versioned internal package once several services have stable identical helpers that repeatedly need the same fix: atomic status-file writing, retry calculation/Retry-After parsing, or database configuration. Avoid a base collector class, shared domain normalization, universal observation tables, or a generic persistence layer. Do not force all ingestion through HTTP solely for uniformity; direct transactions already suit the co-located polling services, while Shake's API destination can remain an explicit option.

## Suggested implementation order and acceptance checks

1. Add focused failure regressions and fix Traffic's incomplete snapshots, transaction recovery, and settings format; fix Shake's failed-write acknowledgment and replay identity.
2. Standardize local module names, settings entry points, CLI modes, status schema, retry/shutdown conventions, and metadata ownership. Preserve current valid-output behavior with fixtures during extraction.
3. Implement source-time windows and bike/traffic provenance and freshness policies, with explicit schema migrations where needed.
4. Batch expensive database operations and add bounded fetch concurrency, measuring before and after.
5. Reassess shared helpers only after the local interfaces settle.

Each collector should have representative source fixtures; valid-empty vs malformed/incomplete tests; timeout/rate-limit tests; storage rollback and reconnect tests; deterministic replay tests; health-after-commit tests; and shutdown tests appropriate to polling or streaming. Put the same commands in CI while retaining each service's independent test process to avoid collisions between modules named `main`, `config`, and `normalize`.

## Verification performed

- Read all four collectors' configuration, orchestration, normalization/fetching, and persistence implementations; inspected Compose/Docker definitions, database schema, relevant API paths, archive worker, and existing tests.
- Smart City: 20 tests passed; 11 database integration tests skipped without a test DSN.
- Shake: 10 tests passed in the available environment. ObsPy was absent; these tests do not verify real MiniSEED decoding.
- Archive: 5 tests passed; 1 database integration test skipped.
- Nextbike: its tests use pytest-style functions; unittest discovery does not run them. The available environment lacks pytest, so these tests were not executed.
- Traffic: no collector-local test suite found. The available environment lacks Pydantic Settings, so the Compose/config mismatch is a static finding pending runtime confirmation.
- No live upstream requests, production database writes, deployments, or performance benchmarks were performed. Local Python verification used the existing Python 3.14 environment, not the services' Docker runtimes.
