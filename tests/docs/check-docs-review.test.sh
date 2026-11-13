#!/bin/sh
# Whole-branch review fix-wave regression tests for check-docs.sh.
# Covers R8 Complexity-Tracking scoping, R7 bare `.md` exemption,
# `--strict` escalation and `--json` output shape. Read-only over fixtures.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO=$(CDPATH= cd -- "$HERE/../.." && pwd)
CHECK="$REPO/scripts/check-docs.sh"
FX="$HERE/fixtures-review"
fail=0
n=0

run() {
  fx=$1; want=$2; rule=$3; mode=${4:-}
  n=$((n+1))
  case "$mode" in
    strict) out=$("$CHECK" --root "$FX/$fx" --strict 2>&1); got=$? ;;
    json)   out=$("$CHECK" --root "$FX/$fx" --json 2>&1); got=$? ;;
    *)      out=$("$CHECK" --root "$FX/$fx" 2>&1); got=$? ;;
  esac
  if [ "$got" -ne "$want" ]; then
    echo "FAIL $fx (${mode:-plain}): exit=$got want=$want"
    printf '%s\n' "$out" | sed 's/^/    /'
    fail=$((fail+1)); return
  fi
  if [ -n "$rule" ] && ! printf '%s\n' "$out" | grep -q "^$rule "; then
    echo "FAIL $fx (${mode:-plain}): missing '$rule' in output"
    printf '%s\n' "$out" | sed 's/^/    /'
    fail=$((fail+1)); return
  fi
  if [ "$want" -eq 0 ]; then
    if [ "$mode" = json ]; then
      printf '%s\n' "$out" | grep -q '"VIOLATIONS":0' || {
        echo "FAIL $fx (json): missing \"VIOLATIONS\":0"
        printf '%s\n' "$out" | sed 's/^/    /'
        fail=$((fail+1)); return
      }
    else
      printf '%s\n' "$out" | grep -q '^VIOLATIONS=0 ' || {
        echo "FAIL $fx (${mode:-plain}): expected VIOLATIONS=0"
        printf '%s\n' "$out" | sed 's/^/    /'
        fail=$((fail+1)); return
      }
    fi
  fi
  echo "PASS $fx (mode=${mode:-plain}, exit=$got${rule:+, rule=$rule})"
}

# R8 must only accept registrations INSIDE the Complexity Tracking section.
# The decoy navigation row names big.md but sits outside CT; strict must report it.
run r8-strict     1 'R8 size'     strict
# Positive control: a real CT row (inside the section) legitimately registers it.
run r8-registered 0 ''            strict
run r8-registered 0 ''            json
# R7 must not exempt a bare `plan.md §99.99` that is not a resolvable link.
run r7-dead-md    1 'R7 section'

echo "REVIEW_TESTS=$n FAILURES=$fail"
[ "$fail" -eq 0 ]
