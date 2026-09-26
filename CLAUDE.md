# ChoreBunny — Claude instructions

## Git workflow

- **Never commit directly to `main`.** Always create a descriptive branch and open a PR.
- Use **conventional commit** prefixes for both branch names and commit messages:
  - `feat/` — new feature
  - `fix/` — bug fix
  - `chore/` — maintenance (deps, config, tooling, docs)
  - `refactor/` — code change with no behavior change
  - `test/` — adding or updating tests
  - `style/` — visual/CSS-only changes
- Examples: `feat/animated-mascot`, `fix/date-timezone`, `chore/add-claude-md`
- Commit messages follow the same prefix: `feat: add animated rabbit mascot with mood states`
- The *why* belongs in the commit body or PR description, not the subject line.

## Stack

- **Backend:** Python 3.12 (FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2)
- **Frontend:** Next.js 16 (App Router, TypeScript, TanStack Query v5, Tailwind v4, Nunito font)
- **Database:** SQLite in dev (file at `backend/chorebunny.db`); Alembic manages migrations
- **Monorepo:** `backend/` and `frontend/` at the repo root; `Makefile` at root for dev commands

## Python environment

- Use `/opt/homebrew/bin/python3.12` (Homebrew install — pyenv cannot build from source on macOS 26 Tahoe)
- Virtual env lives at `backend/.venv`; activate with `source backend/.venv/bin/activate`
- Install deps: `cd backend && pip install -r requirements.txt`

## Dev commands

```bash
make dev          # runs both servers in parallel (backend :8000, frontend :3000)
make dev-backend  # FastAPI with --reload
make dev-frontend # Next.js with Turbopack
make db-init      # alembic upgrade head
make seed         # populate default chores
```

## Testing

- Backend: `cd backend && .venv/bin/pytest` — all tests must stay green
- Frontend: `cd frontend && npm test` — all tests must stay green
- Don't skip or comment out failing tests; fix the root cause
- Backend tests use an in-memory SQLite with `StaticPool` — never use mocks for the DB layer

## Code style

- No unnecessary comments — well-named code is self-documenting
- No premature abstractions — three similar lines beats a helper no one asked for
- No error handling for scenarios that can't happen
- Validate only at system boundaries (user input, external APIs)
- TypeScript: strict mode, no `any`
- Python: type hints on all function signatures

## Design system

- Background: `#FFF8F0` (cream)
- Primary accent: `#F97316` (carrot orange)
- Success: `#4ADE80` (green)
- Info: `#7DD3FC` (sky blue)
- Font: Nunito (rounded, child-friendly)
- Border radius: `rounded-2xl` on cards, `rounded-xl` on buttons/chips
- Tailwind v4 — no `tailwind.config.ts`; config is in `globals.css` via `@import "tailwindcss"`

## API conventions

- All dates over the wire as `YYYY-MM-DD` strings
- Endpoints live under `/api/` prefix
- FastAPI returns 422 automatically for missing/invalid params — don't add manual checks for things Pydantic already validates
- CORS is configured for `http://localhost:3000` in `backend/app/main.py`
