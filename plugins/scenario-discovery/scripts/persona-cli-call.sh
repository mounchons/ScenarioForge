#!/usr/bin/env bash
# persona-cli-call.sh — CLI bridge for beat-1.5 personas that run on a LOCAL AI CLI
# (codex / opencode / gemini / claude ... — see references/persona-registry.md).
#
# Substitutes {PROMPT_FILE} in the command template, then runs the CLI inside an
# EMPTY temp working directory (an agentic CLI that ignores instructions still has
# nothing to read or touch) and prints the CLI's stdout.
#
# Usage:  bash persona-cli-call.sh <command-template> <prompt-file> [timeout_seconds]
#   <command-template>  e.g. 'codex exec --sandbox read-only "$(cat {PROMPT_FILE})"'
# Exit:   0 ok | 2 bad args | 4 prompt file missing | 5 CLI failed or timed out | 6 CLI not on PATH
#
# Auth note: CLI providers use the machine's own login/subscription — no API key
# passes through this script.
set -euo pipefail

TEMPLATE="${1:?usage: persona-cli-call.sh <command-template> <prompt-file> [timeout_seconds]}"
PROMPT="${2:?missing prompt file path}"
TIMEOUT="${3:-180}"

[ -f "$PROMPT" ] || { echo "prompt file not found: $PROMPT" >&2; exit 4; }

# Resolve prompt path to absolute before changing directory (POSIX or Windows drive path)
case "$PROMPT" in
  /*|[A-Za-z]:*) ABS_PROMPT="$PROMPT" ;;
  *)             ABS_PROMPT="$(pwd)/$PROMPT" ;;
esac

CMD="${TEMPLATE//\{PROMPT_FILE\}/$ABS_PROMPT}"

# The template's first word must be a resolvable command
BIN="${TEMPLATE%% *}"
command -v "$BIN" >/dev/null 2>&1 || { echo "CLI not found on PATH: $BIN" >&2; exit 6; }

# Empty sandbox cwd — nothing for the CLI's file tools to see
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if command -v timeout >/dev/null 2>&1; then
  RUN=(timeout "$TIMEOUT" bash -c "$CMD")
else
  RUN=(bash -c "$CMD")   # no coreutils timeout available — rely on the CLI's own limits
fi

if ! (cd "$WORKDIR" && "${RUN[@]}"); then
  echo "CLI persona failed or timed out: $BIN" >&2
  exit 5
fi
