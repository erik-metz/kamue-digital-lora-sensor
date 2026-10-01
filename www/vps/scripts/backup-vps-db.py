"""Stream a consistent custom-format VPS database dump directly to this machine.

No dump file is created on the VPS. Requires an existing trusted SSH connection.
The source database is read only; collectors need not be stopped for this clone.
"""

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
METADATA_SQL = """SELECT json_build_object(
    'database',current_database(),
    'database_user',current_user,
    'server_version',current_setting('server_version'),
    'server_version_num',current_setting('server_version_num'),
    'database_bytes',pg_database_size(current_database()),
    'extensions',(SELECT json_object_agg(extname,extversion) FROM pg_extension)
);"""


def remote_command(directory, command):
    return "cd " + shlex.quote(directory) + " && docker compose exec -T timescaledb sh -c " + shlex.quote(command)


def ssh_options(target, identity=None, port=22):
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.@:\[\]-]*", target):
        raise ValueError("Use an SSH alias or user@hostname, not a shell command")
    if not 1 <= port <= 65535:
        raise ValueError("Invalid SSH port")
    result = ["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
              "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=30",
              "-o", "ServerAliveCountMax=3", "-p", str(port)]
    if identity:
        result.extend(["-i", str(Path(identity).expanduser())])
    return [*result, target]


def copy_archive(stream, output, directory, reserve_bytes):
    """Bounded-memory copy; retain an incomplete .partial on failure."""
    digest = hashlib.sha256()
    size = 0
    header = b""
    while chunk := stream.read(1024 * 1024):
        if len(header) < 5:
            header = (header + chunk)[:5]
        if len(header) == 5 and header != b"PGDMP":
            raise ValueError("SSH output is not a PostgreSQL custom-format dump")
        if size % (64 * 1024 * 1024) == 0 and shutil.disk_usage(directory).free < reserve_bytes + len(chunk):
            raise RuntimeError("Local backup volume is below the free-space reserve")
        output.write(chunk)
        digest.update(chunk)
        size += len(chunk)
    if size < 5 or header != b"PGDMP":
        raise ValueError("Empty or invalid PostgreSQL archive")
    output.flush()
    os.fsync(output.fileno())
    return size, digest.hexdigest()


def backup(args):
    os.umask(0o077)
    ssh = ssh_options(args.target, args.identity, args.port)
    metadata_command = 'psql -X -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c ' + shlex.quote(METADATA_SQL)
    response = subprocess.run([*ssh, remote_command(args.remote_dir, metadata_command)],
                              check=True, capture_output=True, text=True, timeout=60)
    metadata = json.loads(response.stdout)
    if 'timescaledb' not in metadata['extensions']:
        raise ValueError("Source database does not have TimescaleDB installed")
    destination = Path(args.output).expanduser().resolve() / datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    destination.mkdir(parents=True, mode=0o700)
    (destination / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")
    partial = destination / "database.dump.partial"
    error_log = destination / "pg_dump.stderr.log"
    command = 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=3 --lock-wait-timeout=30s'
    with error_log.open("wb") as errors, partial.open("xb") as output:
        process = subprocess.Popen([*ssh, remote_command(args.remote_dir, command)], stdout=subprocess.PIPE, stderr=errors)
        try:
            size, digest = copy_archive(process.stdout, output, destination, args.reserve_gib * 1024**3)
            code = process.wait(timeout=60)
            if code:
                raise RuntimeError(f"Remote pg_dump failed (exit {code}); see {error_log}")
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
            process.stdout.close()
    final = destination / "database.dump"
    partial.rename(final)
    (destination / "database.dump.sha256").write_text(f"{digest}  database.dump\n")
    metadata.update(backup_bytes=size, sha256=digest, finished_at=datetime.now(UTC).isoformat(),
                    restore_verified=False)
    (destination / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps({"directory": str(destination), "bytes": size, "sha256": digest,
                      "restore_verified": False}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="SSH alias or user@host")
    parser.add_argument("--identity", help="Local SSH private-key path; never its contents")
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--remote-dir", default="/home/ubuntu/my-app")
    parser.add_argument("--output", default=str(REPO / ".local-db-rehearsal"))
    parser.add_argument("--reserve-gib", type=int, default=2)
    parsed = parser.parse_args()
    if parsed.reserve_gib < 1:
        parser.error("Keep at least 1 GiB local free-space reserve")
    backup(parsed)
