#!/bin/sh
# Entry point for the local environment commands: up | down | reset | ready.
# Names: development | test. Each name maps to its own Compose project,
# ports, database name, and volumes, so the two can run side by side.
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

repo_root=$(cd "$(dirname "$0")/.." && pwd)
compose_file="$repo_root/compose.yaml"

# Per-environment settings. Project names pair with database names; the app
# role genealogy_app is created by the empty-data-directory init script.
case $name in
  development)
    project=yunpu-dev
    app_port=3000
    database_host_port=5432
    storage_host_port=9000
    database_name=yunpu_dev
    storage_access_key=example-development-access
    storage_secret_key=example-development-secret
    ;;
  test)
    project=yunpu-test
    app_port=3010
    database_host_port=5433
    storage_host_port=9010
    database_name=yunpu_test
    storage_access_key=example-test-access
    storage_secret_key=example-test-secret
    ;;
esac

runtime_dir="$repo_root/.local/runtime/$name"
mkdir -p "$runtime_dir"
pid_file="$runtime_dir/app.pid"
log_file="$runtime_dir/app.log"

# One live address for every readiness poll in this script.
ready_url="http://127.0.0.1:$app_port/api/ready"

# Report readiness by calling the application. The command never starts
# containers here; exit 0 only when the body says ok true.
report_ready() {
  body=$(curl -fsS --max-time 10 "$ready_url" 2>/dev/null) || body=""
  if [ -n "$body" ]; then
    printf '%s\n' "$body"
  fi
  case $body in
    *'"ok":true'*) return 0 ;;
    *) return 1 ;;
  esac
}

# The body is one line of JSON from the application; ok is a quoted boolean.
# curl -f would hide the body on 503, so poll with plain curl and parse.
poll_ready() {
  deadline=$(( $(date +%s) + 60 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if body=$(curl -sS --max-time 5 "$ready_url" 2>/dev/null); then
      case $body in
        *'"ok":true'*)
          printf '%s\n' "$body"
          return 0
          ;;
      esac
    fi
    sleep 1
  done
  return 1
}

# True when some other Compose project already holds the host port. This
# project's own leftovers (a half-started run) do not count: compose up
# replaces them.
port_held_by_other_project() {
  port=$1
  holders=$(docker ps --filter "publish=$port" --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null || true)
  [ -n "$holders" ] || return 1
  while IFS= read -r holder; do
    [ "$holder" = "$project" ] || { printf '%s' "$holder"; return 0; }
  done <<EOF
$holders
EOF
  return 1
}

# True when the port is taken by anything at all, regardless of owner. Used
# for ports this project does not own; self-held ports are fine on re-up.
port_in_use() {
  port=$1
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import socket,sys; s=socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('127.0.0.1', int(sys.argv[1]))) == 0 else 1)" "$port" >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1
  fi
}

check_ports_free() {
  failed=0
  for port in "$database_host_port" "$storage_host_port"; do
    if holder=$(port_held_by_other_project "$port"); then
      printf '%s\n' "port $port is held by another project: $holder" >&2
      failed=1
    elif port_in_use "$port"; then
      holder=$(docker ps --filter "publish=$port" --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null | head -1)
      if [ "$holder" != "$project" ]; then
        printf '%s\n' "port $port is already in use" >&2
        failed=1
      fi
    fi
  done
  [ "$failed" -eq 0 ] || exit 1
}

app_running() {
  [ -f "$pid_file" ] || return 1
  pid=$(cat "$pid_file")
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

stop_app() {
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      waited=0
      while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 20 ]; do
        sleep 0.5
        waited=$((waited + 1))
      done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

wait_containers_healthy() {
  deadline=$(( $(date +%s) + 90 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    postgres_ok=$(docker inspect --format '{{.State.Health.Status}}' "$project-postgres-1" 2>/dev/null || echo starting)
    minio_ok=$(docker inspect --format '{{.State.Health.Status}}' "$project-minio-1" 2>/dev/null || echo starting)
    if [ "$postgres_ok" = "healthy" ] && [ "$minio_ok" = "healthy" ]; then
      return 0
    fi
    sleep 1
  done
  printf '%s\n' "component not healthy: postgres=$postgres_ok minio=$minio_ok" >&2
  return 1
}

write_env_file() {
  cat > "$runtime_dir/.env" <<EOF
YUNPU_ENV=$name
DATABASE_URL=postgres://genealogy_app:example@127.0.0.1:$database_host_port/$database_name
PORT=$app_port
S3_ENDPOINT=http://127.0.0.1:$storage_host_port
S3_BUCKET=yunpu-$name
S3_ACCESS_KEY_ID=$storage_access_key
S3_SECRET_ACCESS_KEY=$storage_secret_key
YUNPU_CAPABILITY_TOKEN=example-$name-capability-token
EOF
}

start_app() {
  if app_running; then
    return 0
  fi
  rm -f "$pid_file"
  write_env_file
  # Dependencies only ever come from pnpm; the app itself runs with bun.
  if [ ! -d "$repo_root/node_modules" ]; then
    (cd "$repo_root" && pnpm install --frozen-lockfile) >&2 || return 1
  fi
  # Run with a clean environment: bun's --env-file does NOT override
  # variables already present in the process environment, and this script is
  # often launched from `bun test --env-file .env.test`, whose variables (e.g.
  # PORT=3010) would otherwise leak in and override this environment's .env.
  # Only PATH and HOME cross over; the app reads everything from its .env.
  (cd "$repo_root" && nohup env -i HOME="$HOME" PATH="$PATH" \
    bun run --env-file "$runtime_dir/.env" apps/api/src/index.ts > "$log_file" 2>&1 & echo $! > "$pid_file")
  return 0
}

compose_up() {
  # test starts from an empty baseline on every launch: this environment's
  # two volumes go before the containers come up. development keeps its
  # volumes across down and up.
  if [ "$name" = "test" ]; then
    docker compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
  fi

  # The MinIO root account doubles as the application's storage account:
  # one credential per environment, generated by this script, never the
  # public minioadmin default. Anonymous reads still fail because the
  # bucket is private.
  DATABASE_HOST_PORT="$database_host_port" \
  STORAGE_HOST_PORT="$storage_host_port" \
  POSTGRES_DB="$database_name" \
  MINIO_ROOT_USER="$storage_access_key" \
  MINIO_ROOT_PASSWORD="$storage_secret_key" \
    docker compose -p "$project" -f "$compose_file" up -d --wait >/dev/null 2>&1 || {
      printf '%s\n' "component failed to start: postgres or minio" >&2
      return 1
    }
}

perform_up() {
  check_ports_free

  # test always starts from an empty baseline: even when it already answers
  # ready, its two volumes go before the containers come back. development
  # alone keeps its volumes across repeated up calls.
  if [ "$name" = "test" ]; then
    stop_app
    docker compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
  elif report_ready >/dev/null 2>&1; then
    # Same development project already running: stay on the existing volume.
    report_ready
    return 0
  fi

  compose_up || return 1
  wait_containers_healthy || return 1
  start_app || return 1

  if ! poll_ready; then
    printf '%s\n' "application did not report ok true" >&2
    return 1
  fi
  return 0
}

case $action in
  up)
    perform_up
    exit $?
    ;;
  down)
    stop_app
    docker compose -p "$project" -f "$compose_file" down --remove-orphans >/dev/null 2>&1 || true
    exit 0
    ;;
  reset)
    stop_app
    # Only the named environment's volumes are deleted here; the other
    # project keeps its containers, volumes, and objects.
    docker compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
    perform_up
    exit $?
    ;;
  ready)
    report_ready
    exit $?
    ;;
esac
