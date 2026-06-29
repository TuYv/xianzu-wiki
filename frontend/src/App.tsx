import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './state/auth';
import { LoginPage } from './pages/LoginPage';
import { ListPage } from './pages/ListPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ListPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
