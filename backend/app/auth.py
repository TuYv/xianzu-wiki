"""鉴权原语:bcrypt 校验 + JWT 签发/校验 + admin 依赖 + 登录限流器。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException, status
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 登录限流器(单机内存计数);main.py 负责挂 app.state.limiter + 异常处理器。
limiter = Limiter(key_func=get_remote_address)

_TOKEN_TTL = timedelta(days=7)


def verify_password(plain: str, password_hash: str) -> bool:
    """bcrypt 校验明文口令是否匹配哈希。"""
    return _pwd_context.verify(plain, password_hash)


def create_access_token() -> str:
    """签发 HS256 JWT,payload {sub: admin, exp: now+7d}。"""
    settings = get_settings()
    payload = {
        "sub": "admin",
        "exp": datetime.now(timezone.utc) + _TOKEN_TTL,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """解码并校验 JWT;无效/过期抛 jwt.PyJWTError 子类。"""
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def require_admin(authorization: str = Header(None)) -> None:
    """FastAPI 依赖:校验 Bearer JWT;缺失/非法/非 admin → 401。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    if payload.get("sub") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
