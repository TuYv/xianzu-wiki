import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './state/auth';
import { LoginPage } from './pages/LoginPage';
import { ListPage } from './pages/ListPage';
import { DetailPage } from './pages/DetailPage';
import { TreePage } from './pages/TreePage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

// 路由表单独导出,便于在 MemoryRouter 下测试(App 仅负责注入 BrowserRouter)
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ListPage />} />
      <Route path="/characters/:id" element={<DetailPage />} />
      <Route path="/tree/:id" element={<TreePage />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={routerFuture}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
