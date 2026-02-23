#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
pnpm install

echo "Building better-sqlite3 native bindings..."
pnpm rebuild better-sqlite3 || true
BSQL_DIR="$(find node_modules/.pnpm -maxdepth 1 -type d -name 'better-sqlite3@*' | head -n1)/node_modules/better-sqlite3"
if [ -d "$BSQL_DIR" ]; then
  pnpm --dir "$BSQL_DIR" run install
fi

echo "Initializing SQLite schema..."
pnpm db:init

echo "Seeding demo data..."
pnpm seed

echo "RevivePass setup complete."
