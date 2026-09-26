# 🐰 ChoreBunny

A rabbit-themed chore tracker for kids. Helps children complete their morning and evening routines by earning carrot rewards for each task.

![ChoreBunny screenshot](docs/screenshot.png)

## Features

- **Morning & evening routines** — auto-redirects based on time of day
- **One-tap task completion** — tap any chore to mark it done
- **Carrot rewards** — each task is worth 1–5 carrots; harder tasks earn more
- **Rabbit mascot** — mood changes as you make progress
- **Celebration confetti** — fires when every task in a routine is done
- **Task manager** — parents can add, hide, or delete chores at `/tasks`

## Architecture

```
chorebunny/
├── backend/      FastAPI (Python 3.12) + SQLAlchemy + SQLite
└── frontend/     Next.js 16 (TypeScript) + Tailwind CSS + TanStack Query
```

**Backend** (`localhost:8000`)
- FastAPI REST API with automatic OpenAPI docs at `/docs`
- SQLAlchemy ORM with Alembic migrations
- SQLite database (file: `backend/chorebunny.db`)
- Key endpoints: `GET /api/tasks`, `POST /api/completions/toggle`, `GET /api/summary`

**Frontend** (`localhost:3000`)
- Next.js App Router with TypeScript
- TanStack Query for server state (optimistic toggle updates)
- Tailwind CSS with a cream/orange/green palette and Nunito font
- Routes: `/morning`, `/evening`, `/tasks`

## Running locally

### Prerequisites

- Python 3.12 ([Homebrew](https://brew.sh): `brew install python@3.12`)
- Node.js 20+ ([Homebrew](https://brew.sh): `brew install node`)

### First-time setup

```bash
# Install dependencies
cd backend && /opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install

# Create database and seed default chores
cd ../backend && .venv/bin/alembic upgrade head && .venv/bin/python seed.py
```

### Start dev servers

```bash
# From the repo root — starts both servers in parallel
make dev
```

Or individually:

```bash
make dev-backend   # FastAPI on http://localhost:8000
make dev-frontend  # Next.js on http://localhost:3000
```

Open **http://localhost:3000** — it redirects to `/morning` or `/evening` based on the current time.

### Running with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Running tests

```bash
# Backend (30 tests)
cd backend && .venv/bin/pytest -v

# Frontend (24 tests)
cd frontend && npm test
```

## Database

SQLite is used for simplicity. The database file lives at `backend/chorebunny.db` and is excluded from version control. To reset it:

```bash
rm backend/chorebunny.db
cd backend && .venv/bin/alembic upgrade head && .venv/bin/python seed.py
```

## Roadmap

- [ ] Parent admin area (separate from the child-facing UI)
- [ ] Streak tracking and historical metrics
- [ ] Multi-child support
- [ ] Carrot savings bank (accumulate across days)
