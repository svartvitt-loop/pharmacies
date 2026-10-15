#!/usr/bin/env bash
# PreToolUse hook for Bash: blocks commands that would run the project's toolchains (Node, Python)
# on the host instead of in a container (./dev …, docker compose run …).
# A guard against slips, not a sandbox: `bash -c "npm …"` and the like get through.
set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty')

# Checks the first word of every simple command: split on ; & | ( ) ` $( and newlines, skip
# variable assignments and prefixes such as env/sudo, and skip here-document bodies (commit messages).
offender=$(printf '%s\n' "$cmd" | awk -v q="'" '
  BEGIN {
    tools = "^(npm|npx|node|nodejs|pnpm|yarn|corepack|bun|deno|uv|uvx|pip|pip3|pipx|python|python3(\\.[0-9]+)?|pytest|ruff|playwright|tsc|vite|vitest|oxlint)$"
    prefixes = "^(sudo|env|exec|time|nohup|command|xargs|if|then|elif|else|while|until|do|!|\\{)$"
    heredoc_re = "<<-?[ \t]*[\"" q "]?[A-Za-z_][A-Za-z0-9_]*"
  }
  heredoc != "" { if ($0 ~ "^[ \t]*" heredoc "[ \t]*$") heredoc = ""; next }
  {
    if (match($0, heredoc_re)) {
      tag = substr($0, RSTART, RLENGTH)
      gsub("<<-?[ \t]*[\"" q "]?", "", tag)
      heredoc = tag
    }
    n = split($0, segs, /[;&|()`]|\$\(/)
    for (i = 1; i <= n; i++) {
      m = split(segs[i], w, /[ \t]+/)
      for (j = 1; j <= m; j++) {
        if (w[j] == "" || w[j] ~ /^[A-Za-z_][A-Za-z0-9_]*=/ || w[j] ~ prefixes) continue
        word = w[j]
        sub(/.*\//, "", word)
        if (word ~ tools) { print word; exit }
        break
      }
    }
  }')

if [ -n "$offender" ]; then
  echo "Blocked: '$offender' would run on the host. Run it in a container instead: ./dev (see ./dev help), or docker compose run --rm --no-deps <web|data|e2e> …" >&2
  exit 2
fi
