#!/usr/bin/env bash
# persona-call.sh — transport bridge for beat-1.5 external personas (see references/persona-registry.md).
# Posts an OpenAI-compatible /chat/completions payload; prints the raw response JSON to stdout.
#
# Usage:  bash persona-call.sh <provider> <payload.json> [timeout_seconds]
# Exit:   0 ok | 2 unknown provider / bad config | 3 missing API key | 4 payload missing | 5 HTTP/transport error
#
# API keys come from environment variables only (never from args or files), and this
# script never prints them. The caller builds payload.json (model + messages) itself.
set -euo pipefail

PROVIDER="${1:?usage: persona-call.sh <provider> <payload.json> [timeout_seconds]}"
PAYLOAD="${2:?missing payload.json path}"
TIMEOUT="${3:-120}"

case "$PROVIDER" in
  openai)     BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}";        KEY="${OPENAI_API_KEY:-}" ;;
  openrouter) BASE_URL="${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}"; KEY="${OPENROUTER_API_KEY:-}" ;;
  gemini)     BASE_URL="${GEMINI_BASE_URL:-https://generativelanguage.googleapis.com/v1beta/openai}"; KEY="${GEMINI_API_KEY:-}" ;;
  deepseek)   BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}";    KEY="${DEEPSEEK_API_KEY:-}" ;;
  groq)       BASE_URL="${GROQ_BASE_URL:-https://api.groq.com/openai/v1}";     KEY="${GROQ_API_KEY:-}" ;;
  xai)        BASE_URL="${XAI_BASE_URL:-https://api.x.ai/v1}";                 KEY="${XAI_API_KEY:-}" ;;
  ollama)     BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434/v1}";        KEY="${OLLAMA_API_KEY:-ollama}" ;;
  custom)     BASE_URL="${PERSONA_BASE_URL:-}";                                KEY="${PERSONA_API_KEY:-}"
              [ -n "$BASE_URL" ] || { echo "custom provider requires PERSONA_BASE_URL" >&2; exit 2; } ;;
  *)          echo "unknown provider: $PROVIDER" >&2; exit 2 ;;
esac

if [ -z "$KEY" ] && [ "$PROVIDER" != "ollama" ]; then
  echo "missing API key env for provider '$PROVIDER' (see references/persona-registry.md)" >&2
  exit 3
fi
[ -f "$PAYLOAD" ] || { echo "payload not found: $PAYLOAD" >&2; exit 4; }

BODY="$(mktemp)"
trap 'rm -f "$BODY"' EXIT

HTTP="$(curl -sS -o "$BODY" -w '%{http_code}' \
  --max-time "$TIMEOUT" --retry 1 --retry-all-errors \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/chat/completions" \
  --data-binary @"$PAYLOAD")" || { echo "transport error calling $PROVIDER" >&2; exit 5; }

if [ "$HTTP" -lt 200 ] || [ "$HTTP" -ge 300 ]; then
  echo "provider $PROVIDER returned HTTP $HTTP" >&2
  cat "$BODY" >&2
  exit 5
fi

cat "$BODY"
