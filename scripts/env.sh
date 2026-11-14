#!/bin/sh
# Argument and prerequisite guards for the environment command.
# Actions: up | down | reset | ready. Names: development | test.
# Later tasks add the actions. This script does not start containers or the
# application, and it does not report the environment ready.
set -eu

if [ "$#" -ne 2 ]; then
  printf '%s\n' "up|down|reset|ready" >&2
  printf '%s\n' "development|test" >&2
  exit 1
fi

action=$1
name=$2

case $action in
  up|down|reset|ready) ;;
  *)
    printf '%s\n' "up|down|reset|ready" >&2
    exit 1
    ;;
esac

case $name in
  development|test) ;;
  *)
    printf '%s\n' "development|test" >&2
    exit 1
    ;;
esac

missing=0
for tool in docker pnpm bun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '%s\n' "$tool" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

# action and name are accepted here and left for later tasks.
: "$action" "$name"

printf '%s\n' "guards passed"
exit 0
