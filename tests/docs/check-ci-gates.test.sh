#!/bin/sh
set -eu
workflow=.github/workflows/verify.yml
[ -f "$workflow" ] || { echo "missing $workflow" >&2; exit 1; }
for needle in \
  '--frozen-lockfile' 'pnpm lint' 'scripts/env.sh up development' \
  'scripts/env.sh up test' 'pnpm test:all' 'check-docs.sh --root docs --strict' \
  'wc -l docs/.check-docs-baseline.txt' ; do
  grep -Fq -- "$needle" "$workflow" || { echo "missing step: $needle" >&2; exit 1; }
done
for needle in '"lint"' '"test:all"' 'tests/console' ; do
  grep -Fq -- "$needle" package.json || { echo "missing script: $needle" >&2; exit 1; }
done
echo "ci gates ok"
