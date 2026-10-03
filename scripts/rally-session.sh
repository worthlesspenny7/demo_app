#!/usr/bin/env bash
# Hold a live simulator session for an interactive agent via named pipes.
#   scripts/rally-session.sh start <name> --scenario builtin:varied --seed 3 [--watch digital]
#   scripts/rally-session.sh send  <name> '{"type":"hello"}'      -> prints one reply line
#   scripts/rally-session.sh stop  <name>
set -euo pipefail
cmd=$1; name=$2; shift 2
dir="${RALLY_SESSION_DIR:-/tmp/rally-sessions}/$name"
case "$cmd" in
  start)
    mkdir -p "$dir"; rm -f "$dir/in" "$dir/out"; mkfifo "$dir/in" "$dir/out"
    ( cd "$(dirname "$0")/.." && exec npx tsx src/agent/cli.ts --stdin "$@" <"$dir/in" >"$dir/out" 2>"$dir/err" ) &
    echo $! > "$dir/pid"
    # keep the input pipe open for the life of the session
    exec 3>"$dir/in"; exec 4<>"$dir/out"; echo $$ > "$dir/holder"; sleep infinity &
    echo "session $name started (pid $(cat "$dir/pid"))" ;;
  send)
    printf '%s\n' "$1" > "$dir/in"
    timeout "${RALLY_SEND_TIMEOUT:-60}" bash -c 'IFS= read -r line < "$1"; printf "%s\\n" "$line"' _ "$dir/out" || { echo '{"type":"error","message":"session not responding (see err file)"}'; } ;;
  stop)
    kill "$(cat "$dir/pid")" 2>/dev/null || true; rm -rf "$dir"; echo "stopped $name" ;;
  *) echo "usage: $0 start|send|stop <name> ..." >&2; exit 2 ;;
esac
