# Deployment

Changes to this collector are committed and pushed to `main`. The repository's
`.github/workflows/ci.yml` validates the code and builds and publishes
`ghcr.io/erik-metz/open-ried-sens-shake-collector:latest` after all required
checks pass.

The VPS Compose service uses that GHCR image. Watchtower can update it normally.
For an immediate deployment after the GitHub build has published successfully:

```sh
cd /root
docker compose pull shake-collector
docker compose up -d --no-deps shake-collector
docker compose ps shake-collector
docker exec shake_collector python main.py --healthcheck
```

The healthcheck prints collector liveness and per-station freshness. A stale
station alone does not fail collector liveness. Docker's start period covers
the time before the first heartbeat is written following container recreation.

Do not pin a locally built image or disable Watchtower as part of the regular
deployment. Temporary emergency overrides must be removed when the corresponding
fix is published to GHCR.
