# SimpleCRM

A small CRM app: leads, opportunities, pipeline stages, custom fields.

## Requirements

- Node.js 20+
- npm 10+

## Install

```sh
npm install
```

## Run

```sh
npm run dev
```

That single command starts both processes:

- **API server** on http://localhost:3000 (Express + TypeORM + SQLite, via `nodemon` + `ts-node`)
- **Web client** on http://localhost:5173 (React + Vite, proxies `/api/*` to the server)

Open http://localhost:5173 in your browser.

## Other scripts

| From the repo root | What it does |
| --- | --- |
| `npm run build` | Builds both packages |
| `npm run typecheck` | Type-checks both packages |
| `npm run lint` | Lints the client |
| `npm test` | Runs the unit/integration suites (Vitest) for both packages |

The database is created automatically on first run: with `synchronize` off, the
server runs its TypeORM migrations on boot and then seeds sample data. No
database file is committed.

### End-to-end smoke checks

`code/client/e2e/*.mjs` are manual Playwright smoke checks used to verify each
feature in a browser. They are **not** part of `npm test` — they require a
running dev server and a global Playwright install:

```sh
npm install -g playwright && playwright install chromium
npm run dev                      # in one terminal
node code/client/e2e/feature3.mjs   # in another (BASE_URL defaults to :5173)
```

## Layout

```
code/
  client/   React + Vite frontend
  server/   Express + TypeORM API
```
