"""Restore a streamed backup into a NEW isolated local TimescaleDB container.

Never accepts a remote database target or an existing container/volume. Does not
start application collectors. Backup, logs and local credentials stay git-ignored.
"""

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path


def run(*args, **kwargs):
    return subprocess.run(list(args), check=True, **kwargs)


def psql(container, statement):
    return run('docker','exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1',
               '-U','postgres','-d','rehearsal','-At', input=statement,
               text=True, capture_output=True).stdout.strip()


def restore(args):
    os.umask(0o077)
    directory = Path(args.backup_directory).resolve()
    metadata = json.loads((directory / 'source.json').read_text())
    archive = directory / 'database.dump'
    if shutil.disk_usage(directory).free < metadata['database_bytes'] + 2 * 1024**3:
        raise RuntimeError('Local volume needs room for the source database plus a 2 GiB reserve before restore')
    if not re.fullmatch(r'ried-rehearsal-[a-z0-9-]+', args.name):
        raise ValueError('Container name must start with ried-rehearsal-')
    if not 1024 <= args.port <= 65535:
        raise ValueError('Use a local unprivileged TCP port')
    for kind, name in [('container',args.name),('volume',args.name+'-data'),('network',args.name+'-net')]:
        existing = subprocess.run(['docker',kind,'inspect',name], capture_output=True, check=False)
        if existing.returncode == 0:
            raise ValueError(f'Refusing to overwrite existing {kind}: {name}')
    with archive.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest != metadata['sha256']:
        raise ValueError('Backup checksum does not match its manifest')
    extension = metadata['extensions']['timescaledb']
    major = int(metadata['server_version_num']) // 10000
    if not re.fullmatch(r'\d+\.\d+\.\d+', extension):
        raise ValueError('Source extension version needs an explicitly reviewed image')
    image = f'timescale/timescaledb:{extension}-pg{major}'
    env_file = directory / (args.name + '.env')
    if env_file.exists():
        raise ValueError('Local credentials already exist; choose a new clone name')
    env_file.write_text('POSTGRES_PASSWORD='+secrets.token_urlsafe(32)+'\nPOSTGRES_DB=rehearsal\n')
    run('docker','network','create','--label','openried.rehearsal=true',args.name+'-net', capture_output=True)
    run('docker','volume','create','--label','openried.rehearsal=true',args.name+'-data', capture_output=True)
    run('docker','run','-d','--name',args.name,'--platform','linux/amd64',
        '--label','openried.rehearsal=true','--network',args.name+'-net','--memory','4g','--cpus','2',
        '--env-file',str(env_file),'-p',f'127.0.0.1:{args.port}:5432',
        '--mount',f'type=volume,source={args.name}-data,target=/var/lib/postgresql/data',
        '--mount',f'type=bind,source={directory},target=/backup,readonly',
        image,'-c','timescaledb.telemetry_level=off', capture_output=True)
    deadline = time.monotonic() + 120
    while subprocess.run(['docker','exec',args.name,'pg_isready','-U','postgres','-d','rehearsal'],
                         capture_output=True, check=False).returncode:
        if time.monotonic() > deadline:
            raise TimeoutError('Local database did not become ready; inspect container logs')
        time.sleep(1)
    actual = json.loads(psql(args.name, "SELECT json_build_object('postgres',current_setting('server_version_num'),'timescale',(SELECT extversion FROM pg_extension WHERE extname='timescaledb'));"))
    if actual['timescale'] != extension or int(actual['postgres']) // 10000 != major:
        raise ValueError('Local PostgreSQL major or TimescaleDB version does not match source')
    owner = args.source_owner or metadata.get('database_user')
    if not owner:
        raise ValueError('Source database role missing; use --source-owner after verifying it')
    if owner != 'postgres':
        psql(args.name, 'CREATE ROLE "' + owner.replace('"','""') + '" NOLOGIN;')
    # A catalogue check is useful, but only a completed restore verifies the dump.
    with (directory / 'archive-contents.txt').open('w') as contents:
        run('docker','exec',args.name,'pg_restore','--list','/backup/database.dump',stdout=contents)
    psql(args.name, 'SELECT timescaledb_pre_restore();')
    log = directory / (args.name + '-restore.log')
    with log.open('w') as output:
        run('docker','exec',args.name,'pg_restore','--exit-on-error','--no-owner','--no-acl',
            '-U','postgres','-d','rehearsal','/backup/database.dump',stdout=output,stderr=subprocess.STDOUT)
    # Disable restored user jobs before ending restore mode. No collectors are
    # started, and the database port is published only on the local loopback.
    psql(args.name, 'SELECT alter_job(job_id,scheduled=>false) FROM timescaledb_information.jobs WHERE job_id >= 1000;')
    psql(args.name, 'SELECT timescaledb_post_restore();')
    psql(args.name, 'ANALYZE;')
    report = {'container':args.name,'host':'127.0.0.1','port':args.port,'database':'rehearsal',
              'credential_file':str(env_file),'image':image,'source_sha256':digest,
              'restored_at':datetime.now(UTC).isoformat(),'restore_verified':True}
    (directory / 'restore.json').write_text(json.dumps(report,indent=2)+'\n')
    metadata['restore_verified'] = True
    (directory / 'source.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup_directory')
    parser.add_argument('--name', default='ried-rehearsal-production')
    parser.add_argument('--port', type=int, default=56138)
    parser.add_argument('--source-owner')
    restore(parser.parse_args())
