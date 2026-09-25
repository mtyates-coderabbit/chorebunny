from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.completions import router as completions_router
from app.routers.tasks import router as tasks_router

app = FastAPI(title="ChoreBunny API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api")
app.include_router(completions_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
