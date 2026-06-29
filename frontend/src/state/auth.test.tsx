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
