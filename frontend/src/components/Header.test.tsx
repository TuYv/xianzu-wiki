import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { AuthProvider } from '../state/auth';
import { setToken } from '../api/client';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

// 真 AuthProvider:isAdmin 取自 localStorage token,故 setToken 必须在 render 前。
function renderHeader() {
  return render(
    <AuthProvider>
      <MemoryRouter future={routerFuture}>
        <Header />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Header', () => {
  it('shows the 登录 link for guests', () => {
    renderHeader();
    const link = screen.getByRole('link', { name: '登录' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('button', { name: '退出' })).toBeNull();
  });

  it('shows the 退出 control for admins', () => {
    setToken('jwt-token');
    renderHeader();
    expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登录' })).toBeNull();
  });

  it('links the site title to home', () => {
    renderHeader();
    const title = screen.getByRole('link', { name: '玄鉴仙族' });
    expect(title.getAttribute('href')).toBe('/');
  });
});
