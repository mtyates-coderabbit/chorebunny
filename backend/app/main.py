import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.dependencies import validate_api_key, verify_api_key
from app.routers.children import router as children_router
from app.routers.completions import router as completions_router
from app.routers.tasks import router as tasks_router

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    validate_api_key()
    yield


app = FastAPI(title="ChoreBunny API", version="1.0.0", lifespan=lifespan)

_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api", dependencies=[Depends(verify_api_key)])
app.include_router(completions_router, prefix="/api", dependencies=[Depends(verify_api_key)])
app.include_router(children_router, prefix="/api", dependencies=[Depends(verify_api_key)])


@app.get("/health")
def health():
    return {"status": "ok"}
