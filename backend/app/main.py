from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlmodel import SQLModel

from app.auth import limiter
from app.config import get_settings
from app.db import engine
from app.routers.auth import router as auth_router
from app.routers.characters import router as characters_router
from app.routers.relationships import router as relationships_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings()  # fail-fast at startup: missing/short JWT_SECRET → won't serve traffic
    # create_all 只建尚不存在的表；模型由后续 Task 导入后生效（schema 演进走 migrations/）。
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(title="玄鉴仙族 character wiki", lifespan=lifespan)

# slowapi 接线：限流装饰器依赖 app.state.limiter + 异常处理器。
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


app.include_router(auth_router)
app.include_router(characters_router)
app.include_router(relationships_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
