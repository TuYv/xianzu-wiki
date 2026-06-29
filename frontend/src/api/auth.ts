import { apiFetch, setToken } from './client';

interface LoginResponse {
  token: string;
}

/** 校验密码 -> 成功则持久化 JWT。失败由 apiFetch 抛 ApiError(401)。 */
export async function login(password: string): Promise<void> {
  const res = await apiFetch<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(res.token);
}
