#!/usr/bin/env bash
# Runs once after the container is built. Keep it defensive: the real app
# code is UNKNOWN until test day, so detect rather than assume.
set -uo pipefail

echo "==> Installing app dependencies"
if [ -f package-lock.json ]; then npm ci || npm install
elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install
elif [ -f yarn.lock ]; then corepack enable && yarn install
else npm install; fi

echo "==> Detecting scripts (so CLAUDE.md / hooks can reference real commands)"
node -e "try{const s=require('./package.json').scripts||{};console.log(JSON.stringify(s,null,2))}catch(e){console.log('no package.json at root')}"

echo "==> TypeORM/SQLite check"
ls -1 *.sqlite *.db 2>/dev/null || echo "(no sqlite db file at root — may be created on first run)"

echo "==> Done. Verify the build runs BEFORE starting Claude:"
echo "    1) start dev server, 2) hit it once in a browser, 3) THEN launch claude"
