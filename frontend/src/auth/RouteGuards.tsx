import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { UserRole } from './contracts';

function requestedPath(pathname: string, search: string) {
  return `${pathname}${search}`;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <main className="auth-pending" data-testid="auth-loading">正在验证访问权限…</main>;
  if (!session) {
    const returnTo = encodeURIComponent(requestedPath(location.pathname, location.search));
    return <Navigate replace to={`/login?returnTo=${returnTo}`} />;
  }
  return <>{children}</>;
}

export function PermissionGuard({ roles, children, fallback = null }: { roles: UserRole[]; children: ReactNode; fallback?: ReactNode }) {
  const { session } = useAuth();
  return session?.user.roles.some((role) => roles.includes(role)) ? <>{children}</> : <>{fallback}</>;
}
