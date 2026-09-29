#!/usr/bin/env bash
# SessionStart for cloud sessions (ephemeral containers): genjutsu skill, Rive CLI, deps.
set -uo pipefail

# genjutsu skill (global)
DEST="$HOME/.agents/skills/genjutsu"
if [ ! -f "$DEST/SKILL.md" ]; then
  if ! { npx -y skills add https://genjutsu.athevon.dev -g -y >/dev/null 2>&1 && [ -f "$DEST/SKILL.md" ]; }; then
    # Fallback: official release zip from GitHub (same layout as npx)
    TMP="$(mktemp -d)"
    curl -fsSL -o "$TMP/gj.zip" https://github.com/AThevon/genjutsu/releases/latest/download/genjutsu.zip \
      && mkdir -p "$DEST" && unzip -qo "$TMP/gj.zip" -d "$DEST"
    rm -rf "$TMP"
  fi
fi
mkdir -p "$HOME/.claude/skills" && ln -sfn "$DEST" "$HOME/.claude/skills/genjutsu"

# Rive CLI (needs releases.rive.app in the network allowlist; headless rendering needs EGL/GL)
if [ ! -x "$HOME/.rive/bin/rive" ]; then
  curl -fsSL https://releases.rive.app/cli/install.sh | bash >/dev/null 2>&1 || echo "rive CLI install failed" >&2
fi
if ! ldconfig -p 2>/dev/null | grep -q libEGL.so.1 && command -v apt-get >/dev/null; then
  (apt-get install -y -qq libegl1 libgl1 libgles2 >/dev/null 2>&1 \
    || { apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq libegl1 libgl1 libgles2 >/dev/null 2>&1; }) \
    || echo "EGL libs install failed" >&2
fi
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$HOME/.rive/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# JS deps (+ postinstall: mediapipe/rive wasm and models into public/)
if [ -f "${CLAUDE_PROJECT_DIR:-.}/package.json" ]; then
  (cd "${CLAUDE_PROJECT_DIR:-.}" && pnpm install --frozen-lockfile >/dev/null 2>&1) || echo "pnpm install failed" >&2
fi
exit 0
