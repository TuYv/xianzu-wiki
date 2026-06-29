import { Link } from 'react-router-dom';
import { useAuth } from '../state/auth';

/** 站点页眉:标题回首页;访客见“登录”,管理员见“退出”。 */
export function Header() {
  const { isAdmin, logout } = useAuth();
  return (
    <header className="site-header">
      <Link to="/" className="site-header__title">
        玄鉴仙族
      </Link>
      <nav className="site-header__nav">
        {isAdmin ? (
          <button type="button" onClick={logout}>
            退出
          </button>
        ) : (
          <Link to="/login">登录</Link>
        )}
      </nav>
    </header>
  );
}
