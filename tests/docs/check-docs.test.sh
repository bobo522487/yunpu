#!/bin/sh
# Fixture-driven tests for scripts/check-docs.sh (Task 2, R1-R8).
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO=$(CDPATH= cd -- "$HERE/../.." && pwd)
CHECK="$REPO/scripts/check-docs.sh"
FX="$HERE/fixtures"
fail=0
n=0

run() {
  fx=$1; want=$2; rule=$3
  n=$((n+1))
  out=$("$CHECK" --root "$FX/$fx" 2>&1); got=$?
  if [ "$got" -ne "$want" ]; then
    echo "FAIL $fx: exit=$got want=$want"
    printf '%s\n' "$out" | sed 's/^/    /'
    fail=$((fail+1)); return
  fi
  if [ -n "$rule" ] && ! printf '%s\n' "$out" | grep -q "^$rule "; then
    echo "FAIL $fx: missing '$rule' in output"
    printf '%s\n' "$out" | sed 's/^/    /'
    fail=$((fail+1)); return
  fi
  if [ "$want" -eq 0 ] && ! printf '%s\n' "$out" | grep -q '^VIOLATIONS=0 '; then
    echo "FAIL $fx: expected VIOLATIONS=0"
    printf '%s\n' "$out" | sed 's/^/    /'
    fail=$((fail+1)); return
  fi
  echo "PASS $fx (exit=$got${rule:+, rule=$rule})"
}

run ok                   0 ''
run broken-link          1 'R1 link'
run crlf                 1 'R2 eol'
run oos-dup              1 'R3 oos-dup'
run dangling             1 'R4 dangling'
run dual                 1 'R5 dual'
run needs-clarification  1 'R6 needs-clarification'
run section              1 'R7 section'
run us-heading           0 ''
run p-marker             0 ''

echo "TESTS=$n FAILURES=$fail"
[ "$fail" -eq 0 ]
