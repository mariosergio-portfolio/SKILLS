#!/usr/bin/env bash
# Installs every skill in this library into a Claude skills folder.
# Claude only discovers skills one level deep (<skills-dir>/<skill-name>/SKILL.md),
# so the atomic/ and composite/ tree is flattened on install.
#
#   ./install.sh                     -> ~/.claude/skills            (all your projects)
#   ./install.sh /path/to/project    -> /path/to/project/.claude/skills
set -euo pipefail

src="$(cd "$(dirname "$0")" && pwd)"
if [ $# -ge 1 ]; then dest="$1/.claude/skills"; else dest="$HOME/.claude/skills"; fi

node "$src/tools/validate-skills.js"
mkdir -p "$dest"

count=0
while IFS= read -r skill_md; do
  dir="$(dirname "$skill_md")"
  name="$(basename "$dir")"
  rm -rf "${dest:?}/$name"
  cp -R "$dir" "$dest/$name"
  count=$((count + 1))
done < <(find "$src/atomic" "$src/composite" -name SKILL.md -not -path '*/references/*')

echo "Installed $count skills into $dest"
