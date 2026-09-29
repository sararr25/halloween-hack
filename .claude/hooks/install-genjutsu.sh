#!/usr/bin/env bash
# Installa la skill genjutsu a livello globale se manca (container cloud effimeri).
set -euo pipefail
DEST="$HOME/.agents/skills/genjutsu"
if [ ! -f "$DEST/SKILL.md" ]; then
  TMP="$(mktemp -d)"
  if npx -y skills add https://genjutsu.athevon.dev -g -y >/dev/null 2>&1 && [ -f "$DEST/SKILL.md" ]; then
    :
  else
    # Fallback: release zip ufficiale da GitHub (stesso layout di npx)
    curl -fsSL -o "$TMP/gj.zip" https://github.com/AThevon/genjutsu/releases/latest/download/genjutsu.zip
    mkdir -p "$DEST" && unzip -qo "$TMP/gj.zip" -d "$DEST"
  fi
  rm -rf "$TMP"
fi
mkdir -p "$HOME/.claude/skills"
ln -sfn "$DEST" "$HOME/.claude/skills/genjutsu"
