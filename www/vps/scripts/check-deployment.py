"""Read-only deployment checks. Uses public endpoints; never prints credentials."""
import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen


def check(base, minimum):
    parsed = urlsplit(base)
    if parsed.scheme not in ('https', 'http') or parsed.username or parsed.password or parsed.query:
        raise ValueError('Use a public backend origin without credentials or query parameters')
    failures = []
    for path in ['/health', '/api/v1/collection/status', '/api/v1/movements/latest']:
        try:
            with urlopen(base.rstrip('/') + path, timeout=20) as response:
                body = json.load(response)
            if path == '/health' and body.get('collector_schema_version', 0) < minimum:
                failures.append(f'{path}: missing or old collector schema version (required {minimum})')
            elif path.endswith('/status') and not isinstance(body.get('sources'), list):
                failures.append(f'{path}: missing source status list')
            elif path.endswith('/latest') and not isinstance(body.get('positions'), list):
                failures.append(f'{path}: missing position batch')
            else:
                print(f'OK {path}')
        except HTTPError as exc:
            failures.append(f'{path}: HTTP {exc.code}')
        except (URLError, TimeoutError, ValueError):
            failures.append(f'{path}: unavailable or invalid JSON')
    for failure in failures:
        print(f'FAIL {failure}')
    if failures:
        print('Check the deployed image, API routing and schema migration; health alone is insufficient.')
    return bool(failures)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backend_origin')
    parser.add_argument('--minimum-schema', type=int, default=20260928)
    args = parser.parse_args()
    sys.exit(check(args.backend_origin,args.minimum_schema))
