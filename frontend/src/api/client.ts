const TOKEN_KEY = 'xjxz_token';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 统一 fetch 封装。
 * - path 不含 /api 前缀,内部拼为 `/api${path}`。
 * - 有 token 时注入 `Authorization: Bearer <token>`。
 * - body 为字符串时自动补 `Content-Type: application/json`。
 * - 401 清 token 并抛 ApiError;其他非 2xx 抛 ApiError(尽力解析 {detail})。
 * - 204 返回 undefined。
 */
export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (typeof opts.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, { ...opts, headers });

  if (res.status === 401) {
    clearToken();
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body && typeof body.detail === 'string') {
        detail = body.detail;
      }
    } catch {
      // 响应非 JSON,沿用 statusText
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
