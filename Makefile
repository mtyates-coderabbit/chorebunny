.PHONY: install db-init seed dev dev-backend dev-frontend

install:
	cd backend && .venv/bin/pip install -r requirements.txt || (python3.12 -m venv backend/.venv && cd backend && .venv/bin/pip install -r requirements.txt)
	cd frontend && npm install

db-init:
	cd backend && .venv/bin/alembic upgrade head

seed:
	cd backend && .venv/bin/python seed.py

dev:
	make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev
