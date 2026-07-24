import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalAuth } from '../auth/AuthProvider';
import { NavigationItem } from './NavigationItem';

const demoId = 'task-demo';

type AppShellProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
};

export function AppShell({ title, eyebrow, children, action }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar" aria-label="主导航">
        <Link className="brand" to="/tasks">
          <span aria-hidden="true">EA</span>
          <b>上新工作台</b>
        </Link>
        <nav aria-label="工作台导航">
          <NavigationItem
            to="/tasks"
            label="任务中心"
            activeWhen={(path) =>
              path === '/' ||
              path === '/tasks' ||
              path === '/tasks/new' ||
              path.includes('/upload') ||
              path.includes('/processing')
            }
          />
          <NavigationItem
            to={`/tasks/${demoId}/products`}
            label="审核工作台"
            activeWhen={(path) =>
              path.includes('/products') ||
              path.includes('/copy') ||
              path.includes('/export')
            }
          />
          <NavigationItem
            to={`/tasks/${demoId}/audit`}
            label="审核记录"
            activeWhen={(path) => path.includes('/audit')}
          />
        </nav>
        <div className="sidebar-foot">演示环境</div>
      </aside>
      <main id="main-content" className="workspace" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {action || <UserNav /> ? (
            <div className="page-actions">
              {action}
              <UserNav />
            </div>
          ) : null}
        </header>
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}

function UserNav() {
  const auth = useOptionalAuth();
  if (!auth?.session) return null;
  const roleLabels: Record<string, string> = {
    operator: '运营人员',
    reviewer: '审核人员',
    admin: '管理员',
  };

  return (
    <div className="current-user">
      <span className="user-avatar" aria-hidden="true">
        {auth.session.user.display_name.slice(0, 1)}
      </span>
      <div>
        <b>{auth.session.user.display_name}</b>
        <small data-testid="current-user-role">
          {auth.session.user.roles
            .map((role) => roleLabels[role] ?? role)
            .join('、')}
        </small>
      </div>
      <button type="button" onClick={() => void auth.signOut()}>
        退出登录
      </button>
    </div>
  );
}
