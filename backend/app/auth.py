from slowapi import Limiter
from slowapi.util import get_remote_address

# 登录限流用；后续鉴权 Task 在本文件追加 verify_password / JWT / require_admin。
limiter = Limiter(key_func=get_remote_address)
