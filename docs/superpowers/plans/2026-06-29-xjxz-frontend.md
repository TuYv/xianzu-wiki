# 玄鉴仙族 Wiki — 前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **前置依赖:** 本计划消费后端计划(`2026-06-29-xjxz-backend.md`)产出的 API。可与后端并行开发(dev 走 vite proxy 到 `localhost:8000`),但集成测试需后端可用。

**Goal:** 构建 Vite + React + TS 单页应用:人物列表/百科详情、族谱树可视化、管理员登录后的在线编辑与导入导出;访客只读。

**Architecture:** SPA 经 `apiFetch` 调后端,JWT 存 localStorage(Bearer);`useAuth` 门控所有编辑 UI;族谱用纯函数 `buildFamilyGraph`(婚姻 union 节点 + dagre TB 布局)喂给 `@xyflow/react`;Markdown 用 react-markdown 默认配置防 XSS。

**Tech Stack:** Node 18+ · React 18 · TypeScript(strict) · Vite · @xyflow/react@^12 · @dagrejs/dagre@^1 · react-markdown@^9 · react-router-dom@^6 · vitest + @testing-library/react。

## Global Constraints

- Node ≥18;React 18;TypeScript `strict: true`,不用 `any`(除非带注释说明)。
- 依赖 @xyflow/react@^12 · @dagrejs/dagre@^1 · react-markdown@^9 · react-router-dom@^6;测试 vitest + @testing-library/react + jsdom。
- Markdown **只用 react-markdown 默认配置,绝不安装/启用 rehype-raw**;头像 URL 渲染前过 `isSafeHttpUrl`。
- JWT 存 localStorage,请求头 `Authorization: Bearer`;401 时清 token 跳登录。
- 所有编辑 UI 用 `useAuth().isAdmin` 门控,访客不可见。
- 严禁占位符:每个写代码的 step 必须给出真实可运行代码。
- 提交遵循 conventional commits,英文小写开头,一个 commit 一件事。

---

### Task 1: 前端脚手架 + 鉴权骨架

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/vite-env.d.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`, `frontend/src/api/auth.ts`
- Create: `frontend/src/state/auth.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Test: `frontend/src/api/client.test.ts`, `frontend/src/api/auth.test.ts`, `frontend/src/state/auth.test.tsx`

**Interfaces:**
- Consumes: 无前序 Task(本 Task 是前端第一块)。仅消费后端契约的 HTTP 形态:`POST /api/login` body `{"password":str}` -> `{"token":str}` | 401;响应头鉴权 `Authorization: Bearer <token>`。
- Produces(后续前端 Task 严格依赖,改名即 bug):
  - `src/types.ts`: `Gender` `Status` `RelType` `ParentRole`(string 联合);`Character` `Relationship` `CharacterDetail`(interface,字段见契约)。
  - `src/api/client.ts`: `getToken():string|null`、`setToken(t:string):void`、`clearToken():void`、`apiFetch<T>(path:string, opts?:RequestInit):Promise<T>`(自动注入 `Authorization: Bearer`,`401` 调 `clearToken` 并抛 `ApiError`)、`ApiError`(class,带 `status:number`)。约定:`path` 不含 `/api` 前缀,`apiFetch` 内部拼 `/api${path}`。
  - `src/api/auth.ts`: `login(password:string):Promise<void>`(调 `POST /api/login`,成功 `setToken`)。
  - `src/state/auth.tsx`: `AuthProvider`、`useAuth():{isAdmin:boolean; login:(pw:string)=>Promise<void>; logout:()=>void}`。
  - `src/pages/LoginPage.tsx`: `LoginPage`(named export,React 组件)。
  - `src/App.tsx`: `App`(named export,挂 `AuthProvider` + `BrowserRouter` + `Routes`,后续 Task 在此追加路由)。

---

- [ ] **Step 1: 脚手架初始化 + 安装依赖**

在仓库根执行(`frontend/` 尚不存在时由 vite 创建):

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz
npm create vite@latest frontend -- --template react-ts
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend
npm install
npm install @xyflow/react@^12 @dagrejs/dagre@^1 react-markdown@^9 react-router-dom@^6
npm install -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25 @types/node
```

期望:`frontend/` 下生成 `package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`src/main.tsx`、`src/App.tsx` 等;`node_modules` 装好,无 ERR。

- [ ] **Step 2: 配置 vite + vitest + npm scripts**

覆盖 `frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
```

创建 `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

在 `frontend/package.json` 的 `scripts` 中,把默认内容改为(保留 `dev`/`build`/`preview`,新增 `test`/`typecheck`):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  }
}
```

确认 `frontend/tsconfig.json`(vite 模板生成,含 `"strict": true`)保持 strict;在其 `compilerOptions` 增加 `"types": ["vitest/globals", "@testing-library/jest-dom"]`(若模板用 references 形式,改在 `tsconfig.app.json` 的 `compilerOptions.types`)。

- [ ] **Step 3: 写失败测试 —— apiFetch 注入 Authorization / 401 清 token**

创建 `frontend/src/api/client.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch, setToken, getToken, clearToken, ApiError } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('has token then injects Authorization Bearer header', async () => {
    setToken('abc123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/characters');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/characters');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer abc123');
  });

  it('no token then omits Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/characters');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('401 clears token and throws ApiError', async () => {
    setToken('stale');
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/characters')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/api/client.test.ts
```

期望:失败,报 `Failed to resolve import './client'` 或 `client.ts` 不存在(模块未实现)。

- [ ] **Step 5: 写最小实现 —— types.ts + client.ts**

创建 `frontend/src/types.ts`:

```ts
export type Gender = 'male' | 'female' | 'unknown';
export type Status = 'alive' | 'dead' | 'unknown';
export type RelType = 'parent' | 'spouse' | 'master' | 'sibling';
export type ParentRole = 'father' | 'mother' | 'adoptive' | 'unknown';

export interface Character {
  id: number;
  name: string;
  aliases: string[];
  gender: Gender;
  generation: string | null;
  realm: string | null;
  affiliation: string | null;
  status: Status;
  avatar_url: string | null;
  bio: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Relationship {
  id: number;
  from_id: number;
  to_id: number;
  type: RelType;
  parent_role: ParentRole | null;
  note: string | null;
}

export interface CharacterDetail extends Character {
  relationships: Relationship[];
}
```

创建 `frontend/src/api/client.ts`:

```ts
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
```

- [ ] **Step 6: 跑测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/api/client.test.ts
```

期望:3 个测试全绿(`Test Files 1 passed`,`Tests 3 passed`)。

- [ ] **Step 7: 写失败测试 —— login 成功后 setToken**

创建 `frontend/src/api/auth.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login } from './auth';
import { getToken, clearToken } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('login', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('posts password and stores returned token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'jwt-token' }));
    vi.stubGlobal('fetch', fetchMock);

    await login('super-secret-password');

    expect(getToken()).toBe('jwt-token');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ password: 'super-secret-password' });
  });

  it('does not store token when login fails (401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('wrong')).rejects.toThrow();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 8: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/api/auth.test.ts
```

期望:失败,`Failed to resolve import './auth'`(`auth.ts` 未实现)。

- [ ] **Step 9: 写最小实现 —— auth.ts**

创建 `frontend/src/api/auth.ts`:

```ts
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
```

- [ ] **Step 10: 跑测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/api/auth.test.ts
```

期望:2 个测试全绿。

- [ ] **Step 11: 写失败测试 —— useAuth.isAdmin 随 token 变化**

创建 `frontend/src/state/auth.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { clearToken, setToken } from '../api/client';

function Probe() {
  const { isAdmin, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{isAdmin ? 'admin' : 'guest'}</span>
      <button onClick={() => void login('pw')}>do-login</button>
      <button onClick={logout}>do-logout</button>
    </div>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useAuth', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('starts as guest then becomes admin after login and guest after logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'jwt' }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status').textContent).toBe('guest');

    await act(async () => {
      screen.getByText('do-login').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('admin');

    act(() => {
      screen.getByText('do-logout').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('guest');
  });

  it('initializes as admin when a token already exists', () => {
    setToken('preexisting');

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status').textContent).toBe('admin');
  });
});
```

- [ ] **Step 12: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/state/auth.test.tsx
```

期望:失败,`Failed to resolve import './auth'`(`state/auth.tsx` 未实现)。

- [ ] **Step 13: 写最小实现 —— state/auth.tsx**

创建 `frontend/src/state/auth.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { clearToken, getToken } from '../api/client';
import { login as apiLogin } from '../api/auth';

interface AuthContextValue {
  isAdmin: boolean;
  login: (pw: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => getToken() !== null);

  const login = useCallback(async (pw: string) => {
    await apiLogin(pw);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 14: 跑测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run test -- src/state/auth.test.tsx
```

期望:2 个测试全绿。

- [ ] **Step 15: 实现 LoginPage + App 路由 + 入口挂载**

创建 `frontend/src/pages/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      navigate('/');
    } catch {
      setError('登录失败,请检查密码');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="login-form">
      <h1>管理员登录</h1>
      <input
        type="password"
        aria-label="password"
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" disabled={submitting}>
        登录
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

覆盖 `frontend/src/App.tsx`(后续 Task 在 `<Routes>` 内追加列表/详情/族谱路由):

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './state/auth';
import { LoginPage } from './pages/LoginPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<main>玄鉴仙族 · 人物百科</main>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

覆盖 `frontend/src/main.tsx`(去掉 vite 模板自带的 `index.css`/`App.css` 引用,避免后续无用资产):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('root element not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

删除模板生成的无用资产以不留破窗:

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && rm -f src/App.css src/index.css src/assets/react.svg
```

- [ ] **Step 16: 全量类型检查 + 测试**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npm run typecheck && npm run test
```

期望:`tsc` 无报错;`Test Files 3 passed`,`Tests 7 passed`。若 `tsc` 因模板默认 `App.tsx` 旧 import 残留报错,确认上面已整体覆盖。

- [ ] **Step 17: 提交**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && git add frontend && git commit -m "feat(frontend): scaffold vite react-ts app with auth client and login skeleton"
```

期望:一个 commit 落地前端脚手架 + 鉴权骨架;`git status` 干净(`xjxz.db`、`node_modules`、`dist` 已被根 `.gitignore` 覆盖)。

---

### Task 2: 人物列表 — characters API、CharacterCard、ListPage(客户端搜索/筛选)

**Files:**
- Create: `frontend/src/api/characters.ts`
- Create: `frontend/src/components/CharacterCard.tsx`
- Create: `frontend/src/pages/ListPage.tsx`
- Test: `frontend/src/api/characters.test.ts`
- Test: `frontend/src/components/CharacterCard.test.tsx`
- Test: `frontend/src/pages/ListPage.test.tsx`

**Interfaces:**
- **Consumes (Task 1 基建,精确签名):**
  - `src/api/client.ts`: `apiFetch<T>(path:string, opts?:RequestInit):Promise<T>`(注入 `Authorization: Bearer`,401 清 token)
  - `src/types.ts`: `interface Character`、`interface CharacterDetail extends Character`、`type Status='alive'|'dead'|'unknown'`
  - `src/lib/safeUrl.ts`: `isSafeHttpUrl(url:string|null|undefined):boolean`
  - 第三方: `react-router-dom@^6` 的 `Link`(测试用 `MemoryRouter`)
- **Produces (后续 Task 依赖,不得改名):**
  - `src/api/characters.ts`: `listCharacters():Promise<Character[]>`、`getCharacter(id:number):Promise<CharacterDetail>`、`createCharacter(c:Partial<Character>):Promise<Character>`、`updateCharacter(id:number,c:Partial<Character>):Promise<Character>`、`deleteCharacter(id:number):Promise<void>`
  - `src/components/CharacterCard.tsx`: `CharacterCard({ character }:{ character:Character }):JSX.Element`(命名导出)
  - `src/pages/ListPage.tsx`: `ListPage():JSX.Element` + 纯函数 `filterCharacters(characters:Character[], keyword:string, affiliation:string, realm:string, status:string):Character[]`(命名导出)

---

- [ ] **Step 1: 写 characters API 失败测试**

`frontend/src/api/characters.test.ts`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from './client';
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from './characters';

describe('characters api', () => {
  beforeEach(() => {
    (apiFetch as any).mockReset();
    (apiFetch as any).mockResolvedValue(undefined);
  });

  it('listCharacters GETs /api/characters', async () => {
    (apiFetch as any).mockResolvedValue([]);
    await listCharacters();
    expect(apiFetch).toHaveBeenCalledWith('/api/characters');
  });

  it('getCharacter GETs /api/characters/{id}', async () => {
    await getCharacter(5);
    expect(apiFetch).toHaveBeenCalledWith('/api/characters/5');
  });

  it('createCharacter POSTs JSON body', async () => {
    await createCharacter({ name: '萧寒' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/characters',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: '萧寒' }) }),
    );
  });

  it('updateCharacter PUTs /api/characters/{id}', async () => {
    await updateCharacter(5, { realm: '金丹' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/characters/5',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ realm: '金丹' }) }),
    );
  });

  it('deleteCharacter DELETEs /api/characters/{id}', async () => {
    await deleteCharacter(5);
    expect(apiFetch).toHaveBeenCalledWith('/api/characters/5', { method: 'DELETE' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

命令: `cd frontend && npx vitest run src/api/characters.test.ts`
期望: 失败,报错形如 `Failed to resolve import "./characters"` 或 `No "listCharacters" export`(实现文件尚不存在)。

- [ ] **Step 3: 写 characters API 最小实现**

`frontend/src/api/characters.ts`:

```ts
import { apiFetch } from './client';
import type { Character, CharacterDetail } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function listCharacters(): Promise<Character[]> {
  return apiFetch<Character[]>('/api/characters');
}

export function getCharacter(id: number): Promise<CharacterDetail> {
  return apiFetch<CharacterDetail>(`/api/characters/${id}`);
}

export function createCharacter(c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>('/api/characters', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function updateCharacter(id: number, c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>(`/api/characters/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function deleteCharacter(id: number): Promise<void> {
  return apiFetch<void>(`/api/characters/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: 跑测试确认通过**

命令: `cd frontend && npx vitest run src/api/characters.test.ts`
期望: `Test Files 1 passed`,`Tests 5 passed`。

- [ ] **Step 5: 提交**

命令:
```bash
cd frontend && git add src/api/characters.ts src/api/characters.test.ts
git commit -m "feat(frontend): add characters api client functions"
```

- [ ] **Step 6: 写 CharacterCard 失败测试**

`frontend/src/components/CharacterCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types';

const base: Character = {
  id: 7,
  name: '萧寒',
  aliases: ['寒少', '冷面君'],
  gender: 'male',
  generation: '三代',
  realm: '金丹',
  affiliation: '萧家',
  status: 'alive',
  avatar_url: null,
  bio: null,
};

function renderCard(c: Character) {
  return render(
    <MemoryRouter>
      <CharacterCard character={c} />
    </MemoryRouter>,
  );
}

describe('CharacterCard', () => {
  it('renders name, aliases and meta', () => {
    renderCard(base);
    expect(screen.getByText('萧寒')).toBeInTheDocument();
    expect(screen.getByText(/寒少/)).toBeInTheDocument();
    expect(screen.getByText(/金丹/)).toBeInTheDocument();
  });

  it('links to the detail page', () => {
    renderCard(base);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/characters/7');
  });

  it('renders avatar img only for a safe http(s) url', () => {
    const { rerender } = renderCard({ ...base, avatar_url: 'http://img/a.png' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/a.png');

    rerender(
      <MemoryRouter>
        <CharacterCard character={{ ...base, avatar_url: 'javascript:alert(1)' }} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: 跑测试确认失败**

命令: `cd frontend && npx vitest run src/components/CharacterCard.test.tsx`
期望: 失败,`Failed to resolve import "./CharacterCard"`。

- [ ] **Step 8: 写 CharacterCard 最小实现**

`frontend/src/components/CharacterCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Character } from '../types';
import { isSafeHttpUrl } from '../lib/safeUrl';

const STATUS_LABEL: Record<Character['status'], string> = {
  alive: '在世',
  dead: '已故',
  unknown: '未知',
};

export function CharacterCard({ character }: { character: Character }): JSX.Element {
  const meta = [character.realm, character.affiliation].filter(Boolean).join(' / ');
  return (
    <Link
      to={`/characters/${character.id}`}
      className="character-card"
      data-testid="character-card"
    >
      {isSafeHttpUrl(character.avatar_url) ? (
        <img
          src={character.avatar_url ?? undefined}
          alt={character.name}
          className="character-card__avatar"
        />
      ) : (
        <div className="character-card__avatar character-card__avatar--placeholder" aria-hidden="true" />
      )}
      <div className="character-card__body">
        <h3 className="character-card__name">{character.name}</h3>
        {character.aliases.length > 0 && (
          <p className="character-card__aliases">{character.aliases.join(' · ')}</p>
        )}
        {meta && <p className="character-card__meta">{meta}</p>}
        <span className={`character-card__status character-card__status--${character.status}`}>
          {STATUS_LABEL[character.status]}
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 9: 跑测试确认通过**

命令: `cd frontend && npx vitest run src/components/CharacterCard.test.tsx`
期望: `Tests 3 passed`。

- [ ] **Step 10: 提交**

命令:
```bash
cd frontend && git add src/components/CharacterCard.tsx src/components/CharacterCard.test.tsx
git commit -m "feat(frontend): add CharacterCard component"
```

- [ ] **Step 11: 写 ListPage 失败测试**

`frontend/src/pages/ListPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListPage, filterCharacters } from './ListPage';
import type { Character } from '../types';

vi.mock('../api/characters', () => ({ listCharacters: vi.fn() }));

import { listCharacters } from '../api/characters';

const SAMPLE: Character[] = [
  { id: 1, name: '萧寒', aliases: ['寒少'], gender: 'male', generation: '三代', realm: '金丹', affiliation: '萧家', status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '柳沉香', aliases: ['香姨'], gender: 'female', generation: '二代', realm: '元婴', affiliation: '柳家', status: 'dead', avatar_url: null, bio: null },
  { id: 3, name: '萧无极', aliases: [], gender: 'male', generation: '一代', realm: '化神', affiliation: '萧家', status: 'alive', avatar_url: null, bio: null },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ListPage />
    </MemoryRouter>,
  );
}

describe('filterCharacters', () => {
  it('matches keyword against name and aliases', () => {
    expect(filterCharacters(SAMPLE, '香姨', '', '', '').map((c) => c.id)).toEqual([2]);
    expect(filterCharacters(SAMPLE, '萧', '', '', '').map((c) => c.id)).toEqual([1, 3]);
  });

  it('filters by status / affiliation / realm', () => {
    expect(filterCharacters(SAMPLE, '', '', '', 'dead').map((c) => c.id)).toEqual([2]);
    expect(filterCharacters(SAMPLE, '', '萧家', '', '').map((c) => c.id)).toEqual([1, 3]);
    expect(filterCharacters(SAMPLE, '', '', '化神', '').map((c) => c.id)).toEqual([3]);
  });
});

describe('ListPage', () => {
  beforeEach(() => {
    (listCharacters as any).mockReset();
    (listCharacters as any).mockResolvedValue(SAMPLE);
  });

  it('renders all characters after load', async () => {
    renderPage();
    expect(await screen.findByText('萧寒')).toBeInTheDocument();
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.getByText('萧无极')).toBeInTheDocument();
  });

  it('filters by keyword across name and aliases', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByPlaceholderText('搜索姓名或别名'), { target: { value: '香姨' } });
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.queryByText('萧寒')).not.toBeInTheDocument();
    expect(screen.queryByText('萧无极')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderPage();
    await screen.findByText('萧寒');
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'dead' } });
    expect(screen.getByText('柳沉香')).toBeInTheDocument();
    expect(screen.queryByText('萧寒')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 12: 跑测试确认失败**

命令: `cd frontend && npx vitest run src/pages/ListPage.test.tsx`
期望: 失败,`Failed to resolve import "./ListPage"`。

- [ ] **Step 13: 写 ListPage 最小实现**

`frontend/src/pages/ListPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Character, Status } from '../types';
import { listCharacters } from '../api/characters';
import { CharacterCard } from '../components/CharacterCard';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'alive', label: '在世' },
  { value: 'dead', label: '已故' },
  { value: 'unknown', label: '未知' },
];

export function filterCharacters(
  characters: Character[],
  keyword: string,
  affiliation: string,
  realm: string,
  status: string,
): Character[] {
  const kw = keyword.trim().toLowerCase();
  return characters.filter((c) => {
    if (kw) {
      const haystack = [c.name, ...c.aliases].join(' ').toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    if (affiliation && c.affiliation !== affiliation) return false;
    if (realm && c.realm !== realm) return false;
    if (status && c.status !== status) return false;
    return true;
  });
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

export function ListPage(): JSX.Element {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [realm, setRealm] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    listCharacters()
      .then((data) => {
        if (active) setCharacters(data);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  const affiliations = useMemo(() => uniqueSorted(characters.map((c) => c.affiliation)), [characters]);
  const realms = useMemo(() => uniqueSorted(characters.map((c) => c.realm)), [characters]);

  const visible = useMemo(
    () => filterCharacters(characters, keyword, affiliation, realm, status),
    [characters, keyword, affiliation, realm, status],
  );

  return (
    <div className="list-page">
      <div className="list-page__filters">
        <input
          type="search"
          placeholder="搜索姓名或别名"
          aria-label="搜索姓名或别名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select aria-label="势力" value={affiliation} onChange={(e) => setAffiliation(e.target.value)}>
          <option value="">全部势力</option>
          {affiliations.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select aria-label="境界" value={realm} onChange={(e) => setRealm(e.target.value)}>
          <option value="">全部境界</option>
          {realms.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="list-page__error">加载失败:{error}</p>}

      <p className="list-page__count">共 {visible.length} 人</p>

      <div className="list-page__grid">
        {visible.map((c) => (
          <CharacterCard key={c.id} character={c} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 14: 跑测试确认通过(并跑全量回归)**

命令: `cd frontend && npx vitest run src/pages/ListPage.test.tsx && npx vitest run`
期望: ListPage 测试 `Tests 5 passed`;全量 `vitest run` 无 fail(Task 1 + Task 2 测试全绿)。

- [ ] **Step 15: 提交**

命令:
```bash
cd frontend && git add src/pages/ListPage.tsx src/pages/ListPage.test.tsx
git commit -m "feat(frontend): add ListPage with client-side search and filter"
```

---

### Task 3: 前端安全渲染层 — safeUrl + Markdown + 人物详情页

**Files:**
- Create: `frontend/src/lib/safeUrl.ts`
- Create: `frontend/src/components/Markdown.tsx`
- Create: `frontend/src/pages/DetailPage.tsx`
- Test: `frontend/src/lib/safeUrl.test.ts`
- Test: `frontend/src/components/Markdown.test.tsx`
- Test: `frontend/src/pages/DetailPage.test.tsx`

**Interfaces:**
- Consumes (前序 Task):
  - `src/types.ts` (Task 1): `Character`, `CharacterDetail`, `Relationship`、枚举 `Gender/Status/RelType/ParentRole`
  - `src/api/characters.ts` (Task 2): `getCharacter(id:number):Promise<CharacterDetail>`、`listCharacters():Promise<Character[]>`
  - `react-router-dom@^6`: `useParams`、`Link`(测试用 `MemoryRouter/Routes/Route`)、`react-markdown@^9` 默认导出
- Produces (后续 Task 依赖):
  - `src/lib/safeUrl.ts`: `isSafeHttpUrl(url:string|null|undefined):boolean`
  - `src/components/Markdown.tsx`: `Markdown(props:{children:string}):JSX.Element`(react-markdown 默认配置,绝不引 `rehype-raw`)
  - `src/pages/DetailPage.tsx`: `DetailPage():JSX.Element`(挂载于路由 `/characters/:id`,供 Task `App.tsx` 路由表使用)

> 说明:`isSafeHttpUrl` 与 `Markdown` 是 spec §6 两道 XSS 防线(头像伪协议拦截 + 原始 HTML 转义),`DetailPage` 是公开百科页(不含 notes,数据来自公开 `CharacterDetail`)。所有 step 在 `frontend/` 目录下执行。

---

- [ ] **Step 1: 写 `isSafeHttpUrl` 失败测试**

创建 `frontend/src/lib/safeUrl.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl } from './safeUrl'

describe('isSafeHttpUrl', () => {
  it('accepts http and https absolute urls', () => {
    expect(isSafeHttpUrl('http://img.example.com/a.png')).toBe(true)
    expect(isSafeHttpUrl('https://img.example.com/a.png')).toBe(true)
  })

  it('rejects javascript: pseudo protocol', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    // 大小写/空白绕过尝试
    expect(isSafeHttpUrl('  JavaScript:alert(1)')).toBe(false)
  })

  it('rejects data: and other non-http schemes', () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeHttpUrl('ftp://example.com/x')).toBe(false)
  })

  it('rejects null, undefined, empty and relative paths', () => {
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl('/local/a.png')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/lib/safeUrl.test.ts
```
期望:`Failed to resolve import "./safeUrl"` / 模块不存在导致的失败(测试无法运行/红)。

- [ ] **Step 3: 写 `isSafeHttpUrl` 最小实现**

创建 `frontend/src/lib/safeUrl.ts`:
```ts
/**
 * 仅当 url 是绝对的 http/https URL 时返回 true。
 * 用于头像等外链渲染前的协议校验,拦截 javascript:/data: 等伪协议(spec §6 XSS 防线)。
 * 相对路径一律视为不安全(头像要求外链图床绝对地址)。
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/lib/safeUrl.test.ts
```
期望:`Test Files 1 passed`,`Tests 4 passed`。

- [ ] **Step 5: 写 `Markdown` 转义失败测试**

创建 `frontend/src/components/Markdown.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders basic markdown to html elements', () => {
    const { container } = render(<Markdown>{'# 标题\n\n正文段落'}</Markdown>)
    expect(container.querySelector('h1')?.textContent).toBe('标题')
    expect(container.querySelector('p')?.textContent).toContain('正文段落')
  })

  it('escapes raw HTML instead of injecting it (no rehype-raw)', () => {
    const { container } = render(
      <Markdown>{'<script>alert(1)</script><b>x</b><img src=x onerror=alert(2)>'}</Markdown>,
    )
    // 关键安全断言:原始 HTML 不得变成真实 DOM 节点
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // 而是作为纯文本转义展示
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/components/Markdown.test.tsx
```
期望:`Failed to resolve import "./Markdown"`,测试红。

- [ ] **Step 7: 写 `Markdown` 最小实现**

创建 `frontend/src/components/Markdown.tsx`:
```tsx
import ReactMarkdown from 'react-markdown'

/**
 * 生平/备注的 Markdown 渲染。
 * 刻意只用 react-markdown 默认配置:不安装也不引入 rehype-raw,
 * 原始 HTML 自动被转义为文本,从渲染层阻断存储型 XSS(spec §6 / §13)。
 */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>
}
```

- [ ] **Step 8: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/components/Markdown.test.tsx
```
期望:`Tests 2 passed`。

- [ ] **Step 9: 写 `DetailPage` 失败测试**

创建 `frontend/src/pages/DetailPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DetailPage } from './DetailPage'
import { getCharacter, listCharacters } from '../api/characters'
import type { CharacterDetail, Character } from '../types'

vi.mock('../api/characters', () => ({
  getCharacter: vi.fn(),
  listCharacters: vi.fn(),
}))

const mockGet = vi.mocked(getCharacter)
const mockList = vi.mocked(listCharacters)

function renderAt(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/characters/${id}`]}>
      <Routes>
        <Route path="/characters/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeDetail(over: Partial<CharacterDetail>): CharacterDetail {
  return {
    id: 1,
    name: '叶凡',
    aliases: [],
    gender: 'male',
    generation: null,
    realm: null,
    affiliation: null,
    status: 'alive',
    avatar_url: null,
    bio: null,
    relationships: [],
    ...over,
  }
}

const others: Character[] = [
  { id: 1, name: '叶凡', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '段德', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DetailPage', () => {
  it('rejects javascript: avatar url (renders no img)', async () => {
    mockGet.mockResolvedValue(makeDetail({ avatar_url: 'javascript:alert(1)' }))
    mockList.mockResolvedValue([])
    const { container } = renderAt(1)
    await screen.findByRole('heading', { name: '叶凡' })
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders safe https avatar and resolves relationship link to other character', async () => {
    mockGet.mockResolvedValue(
      makeDetail({
        avatar_url: 'https://img.example.com/a.png',
        bio: '# 生平\n\n横推万古',
        relationships: [
          { id: 10, from_id: 1, to_id: 2, type: 'master', parent_role: null, note: null },
        ],
      }),
    )
    mockList.mockResolvedValue(others)
    renderAt(1)

    // 关系链接:指向另一方人物,文本是其姓名
    const link = await screen.findByRole('link', { name: '段德' })
    expect(link.getAttribute('href')).toBe('/characters/2')

    // 安全头像被渲染
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://img.example.com/a.png')

    // Markdown 生平被渲染为元素
    expect(screen.getByRole('heading', { name: '生平' })).toBeTruthy()
  })

  it('does not render notes (public detail has no notes field)', async () => {
    mockGet.mockResolvedValue(makeDetail({ bio: '正文' }))
    mockList.mockResolvedValue([])
    const { container } = renderAt(1)
    await screen.findByRole('heading', { name: '叶凡' })
    expect(container.textContent).not.toContain('notes')
  })
})
```

- [ ] **Step 10: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/pages/DetailPage.test.tsx
```
期望:`Failed to resolve import "./DetailPage"`,测试红。

- [ ] **Step 11: 写 `DetailPage` 最小实现**

创建 `frontend/src/pages/DetailPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CharacterDetail } from '../types'
import { getCharacter, listCharacters } from '../api/characters'
import { isSafeHttpUrl } from '../lib/safeUrl'
import { Markdown } from '../components/Markdown'

/**
 * 公开人物详情页(spec §6 百科页)。
 * 数据来自公开接口 CharacterDetail(显式不含 notes):
 *  - 头像经 isSafeHttpUrl 校验后才渲染(拒 javascript: 伪协议)
 *  - 生平走 Markdown(默认转义,阻断存储型 XSS)
 *  - relationships 渲染为指向对方人物的跳转链接
 */
export function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const [character, setCharacter] = useState<CharacterDetail | null>(null)
  const [names, setNames] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const cid = Number(id)
    setCharacter(null)
    setError(null)
    getCharacter(cid)
      .then(setCharacter)
      .catch(() => setError('加载失败'))
    listCharacters()
      .then((cs) => {
        const map: Record<number, string> = {}
        for (const c of cs) map[c.id] = c.name
        setNames(map)
      })
      .catch(() => {
        /* 名称解析失败不阻塞详情渲染,链接降级为 #id */
      })
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!character) return <p>加载中…</p>

  const selfId = character.id
  const safeAvatar = isSafeHttpUrl(character.avatar_url)

  return (
    <article className="detail">
      <header className="detail-header">
        {safeAvatar && (
          <img className="avatar" src={character.avatar_url ?? ''} alt={character.name} />
        )}
        <h1>{character.name}</h1>
        {character.aliases.length > 0 && (
          <p className="aliases">{character.aliases.join('、')}</p>
        )}
      </header>

      <dl className="attributes">
        <dt>性别</dt>
        <dd>{character.gender}</dd>
        <dt>状态</dt>
        <dd>{character.status}</dd>
        {character.generation && (
          <>
            <dt>辈分</dt>
            <dd>{character.generation}</dd>
          </>
        )}
        {character.realm && (
          <>
            <dt>境界</dt>
            <dd>{character.realm}</dd>
          </>
        )}
        {character.affiliation && (
          <>
            <dt>势力</dt>
            <dd>{character.affiliation}</dd>
          </>
        )}
      </dl>

      {character.bio && (
        <section className="bio">
          <Markdown>{character.bio}</Markdown>
        </section>
      )}

      <section className="relationships">
        <h2>关系</h2>
        {character.relationships.length === 0 ? (
          <p>暂无关系</p>
        ) : (
          <ul>
            {character.relationships.map((r) => {
              const otherId = r.from_id === selfId ? r.to_id : r.from_id
              const label = names[otherId] ?? `#${otherId}`
              return (
                <li key={r.id}>
                  <span className="rel-type">{r.type}</span>
                  {r.parent_role && <span className="rel-role">（{r.parent_role}）</span>}
                  <Link to={`/characters/${otherId}`}>{label}</Link>
                  {r.note && <span className="rel-note">{r.note}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </article>
  )
}
```

- [ ] **Step 12: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/pages/DetailPage.test.tsx
```
期望:`Tests 3 passed`。

- [ ] **Step 13: 跑本 Task 全部相关测试 + typecheck**

```bash
cd frontend && npx vitest run src/lib/safeUrl.test.ts src/components/Markdown.test.tsx src/pages/DetailPage.test.tsx && npx tsc --noEmit
```
期望:三个测试文件全绿(共 9 个用例通过),`tsc` 无类型错误输出。

- [ ] **Step 14: 提交**

```bash
cd frontend && git add src/lib/safeUrl.ts src/lib/safeUrl.test.ts \
  src/components/Markdown.tsx src/components/Markdown.test.tsx \
  src/pages/DetailPage.tsx src/pages/DetailPage.test.tsx
git commit -m "feat(frontend): add safe url guard, escaped markdown and character detail page"
```

---

### Task 4: 前端编辑组件 — relationships API、CharacterForm、RelationshipPanel(isAdmin 门控)

**Files:**
- Create: `xjxz/frontend/src/api/relationships.ts`
- Create: `xjxz/frontend/src/components/CharacterForm.tsx`
- Create: `xjxz/frontend/src/components/RelationshipPanel.tsx`
- Test: `xjxz/frontend/src/api/relationships.test.ts`
- Test: `xjxz/frontend/src/components/CharacterForm.test.tsx`
- Test: `xjxz/frontend/src/components/RelationshipPanel.test.tsx`

**Interfaces:**

Consumes (前序 Task 已产出，精确签名):
- `src/api/client.ts`: `apiFetch<T>(path: string, opts?: RequestInit): Promise<T>` — 注入 `Authorization: Bearer`，401 清 token。
- `src/api/characters.ts`: `createCharacter(c: Partial<Character>): Promise<Character>`、`updateCharacter(id: number, c: Partial<Character>): Promise<Character>`。
- `src/state/auth.tsx`: `useAuth(): { isAdmin: boolean; login: (pw: string) => Promise<void>; logout: () => void }`。
- `src/types.ts`: `Character`、`Relationship`、`Gender`、`Status`、`RelType`、`ParentRole`。

Produces (后续 Task 依赖，名称/类型不得改):
- `src/api/relationships.ts`: `listRelationships(): Promise<Relationship[]>`、`createRelationship(r: Omit<Relationship,'id'>): Promise<Relationship>`、`deleteRelationship(id: number): Promise<void>`。
- `src/components/CharacterForm.tsx`: `export function CharacterForm(props: { initial?: Character | null; onSaved?: (character: Character) => void }): JSX.Element | null`。
- `src/components/RelationshipPanel.tsx`: `export function RelationshipPanel(props: { characterId: number; characters: Character[]; relationships: Relationship[]; onChanged?: () => void }): JSX.Element | null`。

---

- [ ] **Step 1: 写 relationships API 失败测试**

创建 `xjxz/frontend/src/api/relationships.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRelationships, createRelationship, deleteRelationship } from './relationships';
import { apiFetch } from './client';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

describe('relationships api', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('listRelationships GETs /api/relationships', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const result = await listRelationships();
    expect(apiFetch).toHaveBeenCalledWith('/api/relationships');
    expect(result).toEqual([]);
  });

  it('createRelationship POSTs the exact payload', async () => {
    const created = { id: 1, from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null };
    vi.mocked(apiFetch).mockResolvedValue(created);
    const r = await createRelationship({ from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null });
    expect(apiFetch).toHaveBeenCalledWith('/api/relationships', {
      method: 'POST',
      body: JSON.stringify({ from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null }),
    });
    expect(r).toEqual(created);
  });

  it('deleteRelationship DELETEs the id path', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await deleteRelationship(7);
    expect(apiFetch).toHaveBeenCalledWith('/api/relationships/7', { method: 'DELETE' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

命令: `cd xjxz/frontend && npx vitest run src/api/relationships.test.ts`
期望: 失败，报错 `Failed to resolve import "./relationships"`（文件不存在）。

- [ ] **Step 3: 写 relationships API 实现**

创建 `xjxz/frontend/src/api/relationships.ts`:

```ts
import { apiFetch } from './client';
import type { Relationship } from '../types';

export function listRelationships(): Promise<Relationship[]> {
  return apiFetch<Relationship[]>('/api/relationships');
}

export function createRelationship(r: Omit<Relationship, 'id'>): Promise<Relationship> {
  return apiFetch<Relationship>('/api/relationships', {
    method: 'POST',
    body: JSON.stringify(r),
  });
}

export function deleteRelationship(id: number): Promise<void> {
  return apiFetch<void>(`/api/relationships/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: 跑测试确认通过**

命令: `cd xjxz/frontend && npx vitest run src/api/relationships.test.ts`
期望: 3 passed。

- [ ] **Step 5: 提交**

```bash
git add xjxz/frontend/src/api/relationships.ts xjxz/frontend/src/api/relationships.test.ts
git commit -m "feat(frontend): add relationships api client"
```

- [ ] **Step 6: 写 CharacterForm 失败测试**

创建 `xjxz/frontend/src/components/CharacterForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterForm } from './CharacterForm';
import * as charactersApi from '../api/characters';
import { useAuth } from '../state/auth';

vi.mock('../state/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../api/characters', () => ({
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
}));

const guest = { isAdmin: false, login: vi.fn(), logout: vi.fn() };
const admin = { isAdmin: true, login: vi.fn(), logout: vi.fn() };

describe('CharacterForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing for guests', () => {
    vi.mocked(useAuth).mockReturnValue(guest);
    const { container } = render(<CharacterForm />);
    expect(container.firstChild).toBeNull();
  });

  it('submits a create payload and calls onSaved', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(charactersApi.createCharacter).mockResolvedValue({ id: 1 } as never);
    const onSaved = vi.fn();
    render(<CharacterForm onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: '玄鉴' } });
    fireEvent.change(screen.getByLabelText('aliases'), { target: { value: '老祖, 剑仙' } });
    fireEvent.click(screen.getByRole('button', { name: '新建' }));
    await waitFor(() => expect(charactersApi.createCharacter).toHaveBeenCalled());
    expect(charactersApi.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name: '玄鉴', aliases: ['老祖', '剑仙'], gender: 'unknown', status: 'alive' }),
    );
    expect(onSaved).toHaveBeenCalledWith({ id: 1 });
  });

  it('submits an update when initial has an id', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(charactersApi.updateCharacter).mockResolvedValue({ id: 5 } as never);
    render(
      <CharacterForm
        initial={{
          id: 5, name: '甲', aliases: [], gender: 'male', generation: null, realm: null,
          affiliation: null, status: 'alive', avatar_url: null, bio: null,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(charactersApi.updateCharacter).toHaveBeenCalledWith(5, expect.objectContaining({ name: '甲' })),
    );
    expect(charactersApi.createCharacter).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: 跑测试确认失败**

命令: `cd xjxz/frontend && npx vitest run src/components/CharacterForm.test.tsx`
期望: 失败，报错 `Failed to resolve import "./CharacterForm"`。

- [ ] **Step 8: 写 CharacterForm 实现**

创建 `xjxz/frontend/src/components/CharacterForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Character, Gender, Status } from '../types';
import { useAuth } from '../state/auth';
import { createCharacter, updateCharacter } from '../api/characters';

interface CharacterFormProps {
  initial?: Character | null;
  onSaved?: (character: Character) => void;
}

const GENDERS: Gender[] = ['male', 'female', 'unknown'];
const STATUSES: Status[] = ['alive', 'dead', 'unknown'];

export function CharacterForm({ initial = null, onSaved }: CharacterFormProps) {
  const { isAdmin } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join(', '));
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'unknown');
  const [generation, setGeneration] = useState(initial?.generation ?? '');
  const [realm, setRealm] = useState(initial?.realm ?? '');
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'alive');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: Partial<Character> = {
      name: name.trim(),
      aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      gender,
      generation: generation.trim() || null,
      realm: realm.trim() || null,
      affiliation: affiliation.trim() || null,
      status,
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      const saved = initial?.id
        ? await updateCharacter(initial.id, payload)
        : await createCharacter(payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="character-form">
      <label>
        姓名
        <input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        别名
        <input
          aria-label="aliases"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="逗号分隔"
        />
      </label>
      <label>
        性别
        <select aria-label="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          {GENDERS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
      <label>
        辈分
        <input aria-label="generation" value={generation} onChange={(e) => setGeneration(e.target.value)} />
      </label>
      <label>
        境界
        <input aria-label="realm" value={realm} onChange={(e) => setRealm(e.target.value)} />
      </label>
      <label>
        所属
        <input aria-label="affiliation" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
      </label>
      <label>
        状态
        <select aria-label="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        头像 URL
        <input aria-label="avatar_url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </label>
      <label>
        生平
        <textarea aria-label="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <label>
        备注
        <textarea aria-label="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{initial?.id ? '保存' : '新建'}</button>
    </form>
  );
}
```

- [ ] **Step 9: 跑测试确认通过**

命令: `cd xjxz/frontend && npx vitest run src/components/CharacterForm.test.tsx`
期望: 3 passed。

- [ ] **Step 10: 提交**

```bash
git add xjxz/frontend/src/components/CharacterForm.tsx xjxz/frontend/src/components/CharacterForm.test.tsx
git commit -m "feat(frontend): add admin-gated CharacterForm"
```

- [ ] **Step 11: 写 RelationshipPanel 失败测试**

创建 `xjxz/frontend/src/components/RelationshipPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RelationshipPanel } from './RelationshipPanel';
import * as relApi from '../api/relationships';
import { useAuth } from '../state/auth';
import type { Character } from '../types';

vi.mock('../state/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../api/relationships', () => ({
  createRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
}));

const guest = { isAdmin: false, login: vi.fn(), logout: vi.fn() };
const admin = { isAdmin: true, login: vi.fn(), logout: vi.fn() };

const chars: Character[] = [
  { id: 1, name: '甲', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '乙', aliases: [], gender: 'female', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
];

describe('RelationshipPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing for guests', () => {
    vi.mocked(useAuth).mockReturnValue(guest);
    const { container } = render(
      <RelationshipPanel characterId={1} characters={chars} relationships={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows parent_role only when type is parent', () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} />);
    expect(screen.queryByLabelText('parent_role')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'spouse' } });
    expect(screen.queryByLabelText('parent_role')).toBeNull();
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'parent' } });
    expect(screen.queryByLabelText('parent_role')).not.toBeNull();
  });

  it('creates a relationship with the exact payload', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.createRelationship).mockResolvedValue({} as never);
    const onChanged = vi.fn();
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('to_id'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'parent' } });
    fireEvent.change(screen.getByLabelText('parent_role'), { target: { value: 'mother' } });
    fireEvent.click(screen.getByRole('button', { name: '添加关系' }));
    await waitFor(() =>
      expect(relApi.createRelationship).toHaveBeenCalledWith({
        from_id: 1, to_id: 2, type: 'parent', parent_role: 'mother', note: null,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('sends parent_role null for non-parent types', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.createRelationship).mockResolvedValue({} as never);
    render(<RelationshipPanel characterId={1} characters={chars} relationships={[]} />);
    fireEvent.change(screen.getByLabelText('to_id'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'spouse' } });
    fireEvent.click(screen.getByRole('button', { name: '添加关系' }));
    await waitFor(() =>
      expect(relApi.createRelationship).toHaveBeenCalledWith({
        from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null,
      }),
    );
  });

  it('deletes a listed relationship', async () => {
    vi.mocked(useAuth).mockReturnValue(admin);
    vi.mocked(relApi.deleteRelationship).mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(
      <RelationshipPanel
        characterId={1}
        characters={chars}
        relationships={[{ id: 9, from_id: 1, to_id: 2, type: 'spouse', parent_role: null, note: null }]}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByLabelText('delete-9'));
    await waitFor(() => expect(relApi.deleteRelationship).toHaveBeenCalledWith(9));
    expect(onChanged).toHaveBeenCalled();
  });
});
```

- [ ] **Step 12: 跑测试确认失败**

命令: `cd xjxz/frontend && npx vitest run src/components/RelationshipPanel.test.tsx`
期望: 失败，报错 `Failed to resolve import "./RelationshipPanel"`。

- [ ] **Step 13: 写 RelationshipPanel 实现**

创建 `xjxz/frontend/src/components/RelationshipPanel.tsx`:

```tsx
import { useMemo, useState, type FormEvent } from 'react';
import type { Character, Relationship, RelType, ParentRole } from '../types';
import { useAuth } from '../state/auth';
import { createRelationship, deleteRelationship } from '../api/relationships';

interface RelationshipPanelProps {
  characterId: number;
  characters: Character[];
  relationships: Relationship[];
  onChanged?: () => void;
}

const REL_TYPES: RelType[] = ['parent', 'spouse', 'master', 'sibling'];
const PARENT_ROLES: ParentRole[] = ['father', 'mother', 'adoptive', 'unknown'];

export function RelationshipPanel({
  characterId,
  characters,
  relationships,
  onChanged,
}: RelationshipPanelProps) {
  const { isAdmin } = useAuth();
  const [toId, setToId] = useState<number | ''>('');
  const [type, setType] = useState<RelType>('parent');
  const [parentRole, setParentRole] = useState<ParentRole>('father');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    characters.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [characters]);

  if (!isAdmin) return null;

  const related = relationships.filter(
    (r) => r.from_id === characterId || r.to_id === characterId,
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (toId === '') return;
    setError(null);
    setBusy(true);
    try {
      await createRelationship({
        from_id: characterId,
        to_id: Number(toId),
        type,
        parent_role: type === 'parent' ? parentRole : null,
        note: note.trim() || null,
      });
      setToId('');
      setNote('');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'add failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    setBusy(true);
    try {
      await deleteRelationship(id);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="relationship-panel">
      <ul>
        {related.map((r) => (
          <li key={r.id}>
            <span>
              {nameById.get(r.from_id) ?? r.from_id} → {nameById.get(r.to_id) ?? r.to_id} ({r.type}
              {r.parent_role ? `/${r.parent_role}` : ''})
            </span>
            <button
              type="button"
              aria-label={`delete-${r.id}`}
              onClick={() => handleDelete(r.id)}
              disabled={busy}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} aria-label="add-relationship">
        <select
          aria-label="to_id"
          value={toId}
          onChange={(e) => setToId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">选择对象</option>
          {characters
            .filter((c) => c.id !== characterId)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
        <select aria-label="type" value={type} onChange={(e) => setType(e.target.value as RelType)}>
          {REL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {type === 'parent' && (
          <select
            aria-label="parent_role"
            value={parentRole}
            onChange={(e) => setParentRole(e.target.value as ParentRole)}
          >
            {PARENT_ROLES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <input aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy || toId === ''}>添加关系</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 14: 跑测试确认通过**

命令: `cd xjxz/frontend && npx vitest run src/components/RelationshipPanel.test.tsx`
期望: 5 passed。

- [ ] **Step 15: 跑本 Task 全量测试 + 类型检查**

命令: `cd xjxz/frontend && npx vitest run src/api/relationships.test.ts src/components/CharacterForm.test.tsx src/components/RelationshipPanel.test.tsx && npx tsc --noEmit`
期望: 全部 passed，`tsc --noEmit` 无报错（strict 通过）。

- [ ] **Step 16: 提交**

```bash
git add xjxz/frontend/src/components/RelationshipPanel.tsx xjxz/frontend/src/components/RelationshipPanel.test.tsx
git commit -m "feat(frontend): add admin-gated RelationshipPanel with conditional parent_role"
```

---

### Task 5: 族谱布局纯函数 + 族谱树组件 + 族谱页

**Files:**
- Create: `frontend/src/lib/familyTreeLayout.ts`
- Create: `frontend/src/components/FamilyTree.tsx`
- Create: `frontend/src/pages/TreePage.tsx`
- Test: `frontend/src/lib/familyTreeLayout.test.ts`

**Interfaces:**
- **Consumes**(前序 Task 已产出,精确签名):
  - `src/types.ts`: `interface Character { id:number; name:string; aliases:string[]; gender:Gender; generation:string|null; realm:string|null; affiliation:string|null; status:Status; avatar_url:string|null; bio:string|null; notes?:string|null; created_at?:string; updated_at?:string }`;`interface Relationship { id:number; from_id:number; to_id:number; type:RelType; parent_role:ParentRole|null; note:string|null }`;`type RelType='parent'|'spouse'|'master'|'sibling'`
  - `src/api/characters.ts`: `listCharacters():Promise<Character[]>`
  - `src/api/relationships.ts`: `listRelationships():Promise<Relationship[]>`
  - `react-router-dom@^6`: `useNavigate`, `useParams`
  - 依赖包:`@xyflow/react@^12`, `@dagrejs/dagre@^1`(已在 package.json)
- **Produces**(后续依赖的精确名称与类型):
  - `src/lib/familyTreeLayout.ts`: `type FlowNode = { id:string; data:{label?:string; character?:Character}; position:{x:number;y:number}; type?:string; hidden?:boolean }`;`type FlowEdge = { id:string; source:string; target:string }`;`buildFamilyGraph(characters:Character[], relationships:Relationship[], focusId:number, depth:number):{nodes:FlowNode[];edges:FlowEdge[]}`
  - `src/components/FamilyTree.tsx`: `FamilyTree`(props `{characters:Character[]; relationships:Relationship[]; focusId:number; depth:number}`)
  - `src/pages/TreePage.tsx`: `TreePage`(从 `useParams` 取 focusId,路由 `/tree/:id` 挂载)

---

- [ ] **Step 1: 写失败测试**(`frontend/src/lib/familyTreeLayout.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { buildFamilyGraph } from './familyTreeLayout';
import type { Character, Relationship } from '../types';

function char(id: number, name: string): Character {
  return {
    id,
    name,
    aliases: [],
    gender: 'unknown',
    generation: null,
    realm: null,
    affiliation: null,
    status: 'alive',
    avatar_url: null,
    bio: null,
  };
}

function parent(id: number, from_id: number, to_id: number): Relationship {
  return { id, from_id, to_id, type: 'parent', parent_role: 'father', note: null };
}

function spouse(id: number, from_id: number, to_id: number): Relationship {
  return { id, from_id, to_id, type: 'spouse', parent_role: null, note: null };
}

const personNodes = (nodes: { id: string }[]) =>
  nodes.filter((n) => !n.id.startsWith('union:'));
const unionNodes = (nodes: { id: string }[]) =>
  nodes.filter((n) => n.id.startsWith('union:'));

describe('buildFamilyGraph', () => {
  it('一对配偶生成一个不可见 union 节点并各连一条边', () => {
    const chars = [char(1, 'A'), char(2, 'B')];
    const rels = [spouse(1, 1, 2)];

    const { nodes, edges } = buildFamilyGraph(chars, rels, 1, 3);

    const unions = unionNodes(nodes);
    expect(unions).toHaveLength(1);
    expect(unions[0].id).toBe('union:1-2');
    expect((unions[0] as { hidden?: boolean }).hidden).toBe(true);
    expect(edges.some((e) => e.source === '1' && e.target === 'union:1-2')).toBe(true);
    expect(edges.some((e) => e.source === '2' && e.target === 'union:1-2')).toBe(true);
  });

  it('夫妻的共同子女挂在 union 节点下,而非直接连父母', () => {
    const chars = [char(1, '父'), char(2, '母'), char(3, '子')];
    const rels = [spouse(1, 1, 2), parent(2, 1, 3), parent(3, 2, 3)];

    const { edges } = buildFamilyGraph(chars, rels, 3, 3);

    expect(edges.some((e) => e.source === 'union:1-2' && e.target === '3')).toBe(true);
    expect(edges.some((e) => e.source === '1' && e.target === '3')).toBe(false);
    expect(edges.some((e) => e.source === '2' && e.target === '3')).toBe(false);
  });

  it('depth 截断生效:focus depth=1 只到上一代,够不到曾祖', () => {
    const chars = [char(1, '曾祖'), char(2, '祖'), char(3, '父'), char(4, '我')];
    const rels = [parent(1, 1, 2), parent(2, 2, 3), parent(3, 3, 4)];

    const { nodes } = buildFamilyGraph(chars, rels, 4, 1);

    const ids = personNodes(nodes)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(['3', '4']);
  });

  it('parent 成环时不死循环,人物去重收敛', () => {
    const chars = [char(1, 'A'), char(2, 'B')];
    const rels = [parent(1, 1, 2), parent(2, 2, 1)];

    const { nodes } = buildFamilyGraph(chars, rels, 1, 10);

    expect(personNodes(nodes)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

命令:`cd frontend && npx vitest run src/lib/familyTreeLayout.test.ts`
期望:失败,报错类似 `Failed to resolve import "./familyTreeLayout"` 或 `buildFamilyGraph is not a function`(实现文件尚不存在)。

- [ ] **Step 3: 写最小实现**(`frontend/src/lib/familyTreeLayout.ts`)

```ts
import dagre from '@dagrejs/dagre';
import type { Character, Relationship } from '../types';

export type FlowNode = {
  id: string;
  data: { label?: string; character?: Character };
  position: { x: number; y: number };
  type?: string;
  hidden?: boolean;
};

export type FlowEdge = { id: string; source: string; target: string };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const UNION_SIZE = 1;

const isUnion = (id: string): boolean => id.startsWith('union:');

function unionId(a: number, b: number): string {
  return `union:${Math.min(a, b)}-${Math.max(a, b)}`;
}

/**
 * 以 focusId 为中心,沿 parent 边上/下各 depth 代 BFS 收集人物,
 * 为每组 spouse 生成不可见 union 节点(配偶→union、union→子女、单亲直连),
 * 用 dagre rankdir=TB 计算坐标。visited 去重防环死循环。
 */
export function buildFamilyGraph(
  characters: Character[],
  relationships: Relationship[],
  focusId: number,
  depth: number,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const byId = new Map<number, Character>();
  for (const c of characters) byId.set(c.id, c);

  // parent: from_id(父/母) -> to_id(子/女)
  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  const spousePairs: Array<[number, number]> = [];
  for (const r of relationships) {
    if (r.type === 'parent') {
      (childrenOf.get(r.from_id) ?? childrenOf.set(r.from_id, []).get(r.from_id)!).push(r.to_id);
      (parentsOf.get(r.to_id) ?? parentsOf.set(r.to_id, []).get(r.to_id)!).push(r.from_id);
    } else if (r.type === 'spouse') {
      spousePairs.push([r.from_id, r.to_id]);
    }
  }

  // BFS 上/下各 depth 代;visited 防环
  const visited = new Set<number>();
  if (byId.has(focusId)) visited.add(focusId);

  let frontier = byId.has(focusId) ? [focusId] : [];
  for (let i = 0; i < depth && frontier.length; i++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const p of parentsOf.get(id) ?? []) {
        if (byId.has(p) && !visited.has(p)) {
          visited.add(p);
          next.push(p);
        }
      }
    }
    frontier = next;
  }
  frontier = byId.has(focusId) ? [focusId] : [];
  for (let i = 0; i < depth && frontier.length; i++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const c of childrenOf.get(id) ?? []) {
        if (byId.has(c) && !visited.has(c)) {
          visited.add(c);
          next.push(c);
        }
      }
    }
    frontier = next;
  }

  // 把已收集者的配偶补进来(同代),保证 union 两端都渲染
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && byId.has(b)) visited.add(b);
    if (visited.has(b) && byId.has(a)) visited.add(a);
  }

  // visited 内的配偶组(归一去重)
  const couples = new Map<string, [number, number]>();
  for (const [a, b] of spousePairs) {
    if (!visited.has(a) || !visited.has(b)) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    couples.set(unionId(lo, hi), [lo, hi]);
  }

  // 节点
  const nodes: FlowNode[] = [];
  for (const id of visited) {
    const c = byId.get(id)!;
    nodes.push({ id: String(id), data: { label: c.name, character: c }, position: { x: 0, y: 0 } });
  }
  for (const [uid] of couples) {
    nodes.push({ id: uid, data: {}, position: { x: 0, y: 0 }, hidden: true });
  }

  // 边(去重)
  const edgeIds = new Set<string>();
  const edges: FlowEdge[] = [];
  const addEdge = (source: string, target: string): void => {
    const id = `e:${source}->${target}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, source, target });
  };

  // 配偶 -> union
  for (const [uid, [a, b]] of couples) {
    addEdge(String(a), uid);
    addEdge(String(b), uid);
  }

  // union/单亲 -> 子女
  for (const child of visited) {
    const ps = (parentsOf.get(child) ?? []).filter((p) => visited.has(p));
    if (ps.length === 0) continue;
    const handled = new Set<number>();
    for (const [uid, [a, b]] of couples) {
      if (ps.includes(a) && ps.includes(b)) {
        addEdge(uid, String(child));
        handled.add(a);
        handled.add(b);
      }
    }
    for (const p of ps) {
      if (!handled.has(p)) addEdge(String(p), String(child));
    }
  }

  // dagre 布局(union 节点 hidden 但参与排版)
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, {
      width: isUnion(n.id) ? UNION_SIZE : NODE_WIDTH,
      height: isUnion(n.id) ? UNION_SIZE : NODE_HEIGHT,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  for (const n of nodes) {
    const pos = g.node(n.id);
    if (!pos) continue;
    const w = isUnion(n.id) ? UNION_SIZE : NODE_WIDTH;
    const h = isUnion(n.id) ? UNION_SIZE : NODE_HEIGHT;
    n.position = { x: pos.x - w / 2, y: pos.y - h / 2 };
  }

  return { nodes, edges };
}
```

- [ ] **Step 4: 跑测试确认通过**

命令:`cd frontend && npx vitest run src/lib/familyTreeLayout.test.ts`
期望:`Test Files  1 passed`,`Tests  4 passed`。

- [ ] **Step 5: 提交**

```bash
cd frontend && git add src/lib/familyTreeLayout.ts src/lib/familyTreeLayout.test.ts
git commit -m "feat(frontend): add buildFamilyGraph union-node family layout"
```

- [ ] **Step 6: 写族谱树组件**(`frontend/src/components/FamilyTree.tsx`)

```tsx
import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';
import type { Character, Relationship } from '../types';
import { buildFamilyGraph } from '../lib/familyTreeLayout';

interface FamilyTreeProps {
  characters: Character[];
  relationships: Relationship[];
  focusId: number;
  depth: number;
}

export function FamilyTree({
  characters,
  relationships,
  focusId,
  depth,
}: FamilyTreeProps): JSX.Element {
  const navigate = useNavigate();

  // 布局 memoize,仅输入变化时重算(spec §4.3)
  const { nodes, edges } = useMemo(
    () => buildFamilyGraph(characters, relationships, focusId, depth),
    [characters, relationships, focusId, depth],
  );

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        data: { label: n.data.label ?? '' },
        position: n.position,
        hidden: n.hidden,
        type: n.type,
        draggable: false,
      })),
    [nodes],
  );

  const rfEdges: Edge[] = useMemo(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    [edges],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('union:')) return;
      navigate(`/characters/${node.id}`);
    },
    [navigate],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={onNodeClick}
        fitView
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 7: 写族谱页**(`frontend/src/pages/TreePage.tsx`)

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Character, Relationship } from '../types';
import { listCharacters } from '../api/characters';
import { listRelationships } from '../api/relationships';
import { FamilyTree } from '../components/FamilyTree';

const DEFAULT_DEPTH = 3; // 默认以当前人物为中心,上下各 3 代(spec §4.3)
const WHOLE_DEPTH = 999; // “查看整族”:不截断

export function TreePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const focusId = Number(id);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [whole, setWhole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listCharacters(), listRelationships()])
      .then(([cs, rs]) => {
        if (!alive) return;
        setCharacters(cs);
        setRelationships(rs);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div style={{ padding: 16 }}>加载中…</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>加载失败:{error}</div>;
  if (!Number.isFinite(focusId) || !characters.some((c) => c.id === focusId)) {
    return <div style={{ padding: 16 }}>未找到该人物</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #eee' }}>
        <button type="button" onClick={() => setWhole((w) => !w)}>
          {whole ? '回到以当前人物为中心' : '查看整族'}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <FamilyTree
          characters={characters}
          relationships={relationships}
          focusId={focusId}
          depth={whole ? WHOLE_DEPTH : DEFAULT_DEPTH}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 类型检查 + 全量测试确认通过**

命令:`cd frontend && npx tsc --noEmit && npx vitest run`
期望:`tsc` 无输出(零类型错误);vitest 全绿,含本任务 4 个 `familyTreeLayout` 用例。

- [ ] **Step 9: 提交**

```bash
cd frontend && git add src/components/FamilyTree.tsx src/pages/TreePage.tsx
git commit -m "feat(frontend): add FamilyTree renderer and TreePage with whole-clan toggle"
```

---

### Task 6: 前端导入/导出 — `src/api/io.ts` + `src/components/ImportExport.tsx`

**Files:**
- Modify: `/Users/rick/SourceLib/fishNotExist/xjxz/frontend/src/types.ts` (新增 `ExportPayload` / `ImportPayload` / `RelationshipImport`)
- Create: `/Users/rick/SourceLib/fishNotExist/xjxz/frontend/src/api/io.ts`
- Create: `/Users/rick/SourceLib/fishNotExist/xjxz/frontend/src/components/ImportExport.tsx`
- Test: `/Users/rick/SourceLib/fishNotExist/xjxz/frontend/src/api/io.test.ts`
- Test: `/Users/rick/SourceLib/fishNotExist/xjxz/frontend/src/components/ImportExport.test.tsx`

**Interfaces:**

Consumes (来自前序 Task,精确签名,不得改名):
- `src/api/client.ts`: `apiFetch<T>(path:string, opts?:RequestInit):Promise<T>` — 注入 `Authorization: Bearer`,401 时 `clearToken`
- `src/state/auth.tsx`: `useAuth():{ isAdmin:boolean; login:(pw:string)=>Promise<void>; logout:()=>void }`
- `src/types.ts`: `Character`、`Relationship`、`RelType`、`ParentRole`

Produces (后续/集成 Task 依赖):
- `src/types.ts`: `interface ExportPayload { characters: Character[]; relationships: Relationship[] }`、`interface ImportPayload { characters: Partial<Character>[]; relationships: RelationshipImport[] }`、`interface RelationshipImport { from_name:string; to_name:string; type:RelType; parent_role?:ParentRole|null; note?:string|null }`
- `src/api/io.ts`: `exportData():Promise<ExportPayload>`、`importData(p:ImportPayload):Promise<{imported_characters:number;imported_relationships:number}>`
- `src/components/ImportExport.tsx`: `export function ImportExport(): JSX.Element | null` — 经 `useAuth` 门控,非 admin 返回 `null`

---

- [ ] **Step 1: 新增导入/导出 payload 类型** (Modify `src/types.ts`)

在 `src/types.ts` 末尾追加(`RelType` / `ParentRole` / `Character` / `Relationship` 已在前序 Task 定义):

```ts
export interface RelationshipImport {
  from_name: string;
  to_name: string;
  type: RelType;
  parent_role?: ParentRole | null;
  note?: string | null;
}

export interface ImportPayload {
  characters: Partial<Character>[];
  relationships: RelationshipImport[];
}

export interface ExportPayload {
  characters: Character[];
  relationships: Relationship[];
}
```

- [ ] **Step 2: 写 `io.ts` 失败测试** (Create `src/api/io.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';
import { exportData, importData } from './io';
import type { ImportPayload } from '../types';

const mockedFetch = vi.mocked(apiFetch);

describe('io api', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('exportData GETs /api/export and returns payload', async () => {
    mockedFetch.mockResolvedValue({ characters: [], relationships: [] });
    const result = await exportData();
    expect(mockedFetch).toHaveBeenCalledWith('/api/export');
    expect(result).toEqual({ characters: [], relationships: [] });
  });

  it('importData POSTs /api/import with the exact JSON payload', async () => {
    mockedFetch.mockResolvedValue({ imported_characters: 2, imported_relationships: 1 });
    const payload: ImportPayload = {
      characters: [{ name: 'A' }, { name: 'B' }],
      relationships: [{ from_name: 'A', to_name: 'B', type: 'spouse' }],
    };
    const result = await importData(payload);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [path, opts] = mockedFetch.mock.calls[0];
    expect(path).toBe('/api/import');
    expect(opts?.method).toBe('POST');
    expect(JSON.parse(opts?.body as string)).toEqual(payload);
    expect(result).toEqual({ imported_characters: 2, imported_relationships: 1 });
  });
});
```

- [ ] **Step 3: 跑测试确认失败** (精确命令 + 期望)

命令:
```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npx vitest run src/api/io.test.ts
```
期望:测试加载失败 / 报错,信息形如 `Failed to resolve import "./io"`(`io.ts` 尚不存在),退出码非 0。

- [ ] **Step 4: 写 `io.ts` 最小实现** (Create `src/api/io.ts`)

```ts
import { apiFetch } from './client';
import type { ExportPayload, ImportPayload } from '../types';

export function exportData(): Promise<ExportPayload> {
  return apiFetch<ExportPayload>('/api/export');
}

export function importData(
  p: ImportPayload,
): Promise<{ imported_characters: number; imported_relationships: number }> {
  return apiFetch<{ imported_characters: number; imported_relationships: number }>('/api/import', {
    method: 'POST',
    body: JSON.stringify(p),
  });
}
```

- [ ] **Step 5: 跑测试确认通过** (精确命令 + 期望)

命令:
```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npx vitest run src/api/io.test.ts
```
期望:`2 passed`,退出码 0。

- [ ] **Step 6: 提交 io api** (git add + conventional commit)

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && \
git add frontend/src/types.ts frontend/src/api/io.ts frontend/src/api/io.test.ts && \
git commit -m "feat(frontend): add import/export api client and payload types"
```

- [ ] **Step 7: 写 `ImportExport` 组件失败测试** (Create `src/components/ImportExport.test.tsx`)

覆盖三条行为:导出触发带数据的下载、导入解析文件后以正确 payload 调用 `importData`、非 admin 不渲染。

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/io', () => ({
  exportData: vi.fn(),
  importData: vi.fn(),
}));
vi.mock('../state/auth', () => ({
  useAuth: vi.fn(),
}));

import { exportData, importData } from '../api/io';
import { useAuth } from '../state/auth';
import { ImportExport } from './ImportExport';
import type { ImportPayload } from '../types';

const mockedExport = vi.mocked(exportData);
const mockedImport = vi.mocked(importData);
const mockedUseAuth = vi.mocked(useAuth);

function setAdmin(isAdmin: boolean): void {
  mockedUseAuth.mockReturnValue({ isAdmin, login: vi.fn(), logout: vi.fn() });
}

describe('ImportExport', () => {
  beforeEach(() => {
    mockedExport.mockReset();
    mockedImport.mockReset();
    mockedUseAuth.mockReset();
  });

  it('renders nothing for non-admin', () => {
    setAdmin(false);
    const { container } = render(<ImportExport />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('导出 JSON')).toBeNull();
  });

  it('export click downloads a JSON blob containing the data', async () => {
    setAdmin(true);
    mockedExport.mockResolvedValue({
      characters: [{ id: 1, name: 'A', aliases: [], gender: 'unknown', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null }],
      relationships: [],
    } as never);

    const createUrl = vi.fn(() => 'blob:mock');
    const revokeUrl = vi.fn();
    (URL as unknown as { createObjectURL: typeof createUrl }).createObjectURL = createUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeUrl }).revokeObjectURL = revokeUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ImportExport />);
    fireEvent.click(screen.getByText('导出 JSON'));

    await waitFor(() => expect(mockedExport).toHaveBeenCalledTimes(1));
    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = createUrl.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toContain('"name": "A"');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:mock');

    clickSpy.mockRestore();
  });

  it('import parses the selected file and calls importData with the parsed payload', async () => {
    setAdmin(true);
    mockedImport.mockResolvedValue({ imported_characters: 1, imported_relationships: 0 });
    const payload: ImportPayload = { characters: [{ name: 'A' }], relationships: [] };

    render(<ImportExport />);
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File([JSON.stringify(payload)], 'data.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockedImport).toHaveBeenCalledWith(payload));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 8: 跑测试确认失败** (精确命令 + 期望)

命令:
```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npx vitest run src/components/ImportExport.test.tsx
```
期望:加载失败,信息形如 `Failed to resolve import "./ImportExport"`(组件尚不存在),退出码非 0。

- [ ] **Step 9: 写 `ImportExport` 最小实现** (Create `src/components/ImportExport.tsx`)

```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../state/auth';
import { exportData, importData } from '../api/io';
import type { ImportPayload } from '../types';

export function ImportExport(): JSX.Element | null {
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');

  if (!isAdmin) {
    return null;
  }

  async function handleExport(): Promise<void> {
    setMessage('');
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xjxz-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('导出完成');
    } catch (err) {
      setMessage(`导出失败:${(err as Error).message}`);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setMessage('');
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ImportPayload;
      const result = await importData(payload);
      setMessage(`导入完成:人物 ${result.imported_characters},关系 ${result.imported_relationships}`);
    } catch (err) {
      setMessage(`导入失败:${(err as Error).message}`);
    } finally {
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  return (
    <div className="import-export">
      <button type="button" onClick={handleExport}>
        导出 JSON
      </button>
      <label>
        导入 JSON
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          data-testid="import-input"
          onChange={handleImportFile}
        />
      </label>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 10: 跑测试确认通过** (精确命令 + 期望)

命令:
```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npx vitest run src/components/ImportExport.test.tsx
```
期望:`3 passed`(非 admin 不渲染、导出下载、导入解析并传 payload),退出码 0。

- [ ] **Step 11: 跑该 Task 全部测试 + 类型检查** (回归确认无破坏)

命令:
```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/frontend && npx vitest run src/api/io.test.ts src/components/ImportExport.test.tsx && npx tsc --noEmit
```
期望:`5 passed`;`tsc --noEmit` 无输出、退出码 0。

- [ ] **Step 12: 提交组件** (git add + conventional commit)

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && \
git add frontend/src/components/ImportExport.tsx frontend/src/components/ImportExport.test.tsx && \
git commit -m "feat(frontend): add admin-gated ImportExport component"
```
