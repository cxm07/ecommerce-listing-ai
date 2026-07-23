import { Link, useLocation } from 'react-router-dom';

export function NavigationItem({ to, label, activeWhen }: { to: string; label: string; activeWhen: (pathname: string) => boolean }) {
  const { pathname } = useLocation();
  const active = activeWhen(pathname);
  return <Link className={active ? 'navigation-item is-active' : 'navigation-item'} aria-current={active ? 'page' : undefined} to={to}>{label}</Link>;
}
