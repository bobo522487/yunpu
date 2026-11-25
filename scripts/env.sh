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

# Docker and Podman both provide Compose. Prefer Docker when both are
# installed; accept either one so a Podman-only host can run the same flow.
runtime=""
if command -v docker >/dev/null 2>&1; then
  runtime=docker
elif command -v podman >/dev/null 2>&1; then
  runtime=podman
else
  printf '%s\n' docker podman >&2
fi

missing=0
for tool in pnpm node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '%s\n' "$tool" >&2
    missing=1
  fi
done

if [ -z "$runtime" ] || [ "$missing" -ne 0 ]; then
  exit 1
fi

repo_root=$(cd "$(dirname "$0")/.." && pwd)
compose_file="$repo_root/compose.yaml"

# Per-environment settings. Project names pair with database names; the app
# role genealogy_app is created by the empty-data-directory init script.
case $name in
  development)
    project=yunpu-dev
    app_port=3001
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

# Compose project owners holding a published host port. Both Docker and
# Podman expose the Compose project label and the published-port list here;
# Podman has no `ps --filter publish`, so match the port text in the shell.
compose_projects_for_port() {
  port=$1
  rows=$("$runtime" ps --format '{{.Names}}|{{index .Labels "com.docker.compose.project"}}|{{.Ports}}' 2>/dev/null || true)
  printf '%s\n' "$rows" | while IFS='|' read -r _name owner ports; do
    case $ports in
      *":$port->"*) printf '%s\n' "$owner" ;;
    esac
  done
}

# True when some other Compose project already holds the host port. This
# project's own leftovers (a half-started run) do not count: compose up
# replaces them.
port_held_by_other_project() {
  port=$1
  holders=$(compose_projects_for_port "$port")
  [ -n "$holders" ] || return 1
  while IFS= read -r holder; do
    [ -n "$holder" ] || continue
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
  # A stack that already answers ready owns this environment's published
  # ports. That is authoritative even when `runtime ps` cannot list containers
  # (e.g. a sandbox with a read-only runtime dir): treat `up` as idempotent
  # instead of misreporting a foreign port conflict.
  if report_ready >/dev/null 2>&1; then
    return 0
  fi

  failed=0
  for port in "$database_host_port" "$storage_host_port"; do
    if holder=$(port_held_by_other_project "$port"); then
      printf '%s\n' "port $port is held by another project: $holder" >&2
      failed=1
    elif port_in_use "$port"; then
      holder=$(compose_projects_for_port "$port" | head -1)
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

# Docker Compose names containers `<project>-<service>-1`; podman-compose
# uses `<project>_<service>_1`. Accept both so health checks work on either.
container_health() {
  service=$1
  for candidate in "$project-$service-1" "${project}_${service}_1"; do
    if status=$("$runtime" inspect --format '{{.State.Health.Status}}' "$candidate" 2>/dev/null); then
      if [ -n "$status" ]; then
        printf '%s' "$status"
        return 0
      fi
    fi
  done
  printf 'starting'
}

wait_containers_healthy() {
  deadline=$(( $(date +%s) + 90 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    postgres_ok=$(container_health postgres)
    minio_ok=$(container_health minio)
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
AUTH_DATABASE_URL=postgres://auth_runtime:example@127.0.0.1:$database_host_port/$database_name
MIGRATE_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$database_host_port/$database_name
BETTER_AUTH_SECRET=example-$name-better-auth-secret-0123456789
BETTER_AUTH_URL=http://127.0.0.1:$app_port
PORT=$app_port
S3_ENDPOINT=http://127.0.0.1:$storage_host_port
S3_BUCKET=yunpu-$name
S3_ACCESS_KEY_ID=$storage_access_key
S3_SECRET_ACCESS_KEY=$storage_secret_key
YUNPU_CAPABILITY_TOKEN=example-$name-capability-token
EOF
  # Repo-root copies are gitignored; Vitest loads `.env.test` in CI after
  # `env.sh up test`, so the runtime file must be mirrored here.
  case $name in
    test) cp "$runtime_dir/.env" "$repo_root/.env.test" ;;
    development) cp "$runtime_dir/.env" "$repo_root/.env.development" ;;
  esac
}

bootstrap_db_roles() {
  "$runtime" compose -p "$project" -f "$compose_file" exec -T postgres \
    psql -U postgres -d "$database_name" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_definer') THEN
    CREATE ROLE rls_definer NOLOGIN BYPASSRLS;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_runtime') THEN
    CREATE ROLE auth_runtime LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE auth_runtime WITH LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;
SQL
}

run_migrations() {
  (cd "$repo_root" && MIGRATE_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:$database_host_port/$database_name" \
    node --import ./scripts/ts-ext-register.mjs packages/db/src/migrate.ts --env "$name") || return 1
}

start_app() {
  if app_running; then
    return 0
  fi
  rm -f "$pid_file"
  write_env_file
  # Dependencies only ever come from pnpm; the app itself runs with Node.
  if [ ! -d "$repo_root/node_modules" ]; then
    (cd "$repo_root" && pnpm install --frozen-lockfile) >&2 || return 1
  fi
  # Run with a clean environment so host env vars (e.g. PORT from a prior
  # test process) cannot override this environment's .env file. Only PATH
  # and HOME cross over; the app reads everything via Node --env-file.
  # ts-ext-register resolves extensionless .ts imports under Node type-stripping.
  (cd "$repo_root" && nohup env -i HOME="$HOME" PATH="$PATH" \
    node --import ./scripts/ts-ext-register.mjs --env-file="$runtime_dir/.env" apps/api/src/index.ts > "$log_file" 2>&1 & echo $! > "$pid_file")
  return 0
}

compose_up() {
  # Docker Compose waits on healthchecks itself; podman-compose has no --wait
  # flag, so wait_containers_healthy covers both runtimes uniformly.
  wait_flag=""
  if [ "$runtime" = docker ]; then
    wait_flag="--wait"
  fi

  # test starts from an empty baseline on every launch: this environment's
  # two volumes go before the containers come up. development keeps its
  # volumes across down and up.
  if [ "$name" = "test" ]; then
    "$runtime" compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
  fi

  # The MinIO root account doubles as the application's storage account:
  # one credential per environment, generated by this script, never the
  # public minioadmin default. Anonymous reads still fail because the
  # bucket is private.
  compose_log="$runtime_dir/compose-up.log"
  if ! DATABASE_HOST_PORT="$database_host_port" \
    STORAGE_HOST_PORT="$storage_host_port" \
    POSTGRES_DB="$database_name" \
    MINIO_ROOT_USER="$storage_access_key" \
    MINIO_ROOT_PASSWORD="$storage_secret_key" \
      "$runtime" compose -p "$project" -f "$compose_file" up -d $wait_flag >"$compose_log" 2>&1
  then
    printf '%s\n' "component failed to start: postgres or minio" >&2
    if [ -f "$compose_log" ]; then
      tail -n 80 "$compose_log" >&2 || true
    fi
    "$runtime" compose -p "$project" -f "$compose_file" ps >&2 || true
    return 1
  fi
}

perform_up() {
  check_ports_free

  # test always starts from an empty baseline: even when it already answers
  # ready, its two volumes go before the containers come back. development
  # alone keeps its volumes across repeated up calls.
  if [ "$name" = "test" ]; then
    stop_app
    "$runtime" compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
  elif report_ready >/dev/null 2>&1; then
    # Same development project already running: stay on the existing volume.
    # Still refresh the gitignored env mirrors Vitest / tooling read.
    write_env_file
    report_ready
    return 0
  fi

  compose_up || return 1
  wait_containers_healthy || return 1
  bootstrap_db_roles || return 1
  run_migrations || return 1
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
    "$runtime" compose -p "$project" -f "$compose_file" down --remove-orphans >/dev/null 2>&1 || true
    exit 0
    ;;
  reset)
    stop_app
    # Only the named environment's volumes are deleted here; the other
    # project keeps its containers, volumes, and objects.
    "$runtime" compose -p "$project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
    perform_up
    exit $?
    ;;
  ready)
    report_ready
    exit $?
    ;;
esac
