#!/usr/bin/env bash
# Run each service in its own interpreter: local module names intentionally match.
set -euo pipefail
cd "$(dirname "$0")"
for service in smartcity nextbike traffic shake; do
  PYTHONPATH="$service-collector:tests" "${PYTHON:-python3}" -m pytest -q "$service-collector/tests"
done
PYTHONPATH=api/v1:tests "${PYTHON:-python3}" -m pytest -q api/v1/tests
(cd archive-worker && node --test)
