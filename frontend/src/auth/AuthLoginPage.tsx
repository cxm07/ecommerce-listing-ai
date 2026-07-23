import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import './auth.css';

function safeReturnTo(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/tasks';
}

export function AuthLoginPage() {
  const { status, session, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@example.invalid');
  const [error, setError] = useState('');
  const destination = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));

  if (status === 'authenticated' && session) return <Navigate replace to={destination} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await signIn({ email });
      navigate(destination, { replace: true });
    } catch {
      setError('登录暂时不可用，请稍后重试。');
    }
  };

  return <main className="login-layout" data-testid="login-page">
    <section className="login-card">
      <div className="login-mark">EA</div>
      <p className="eyebrow">Ecommerce listing AI</p>
      <h1>登录上新工作台</h1>
      <p className="muted">当前使用可替换的演示身份。真实认证服务接入后无需改动业务路由。</p>
      <form onSubmit={submit}>
        <label>工作邮箱<input aria-label="工作邮箱" value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={status === 'loading'}>使用演示身份登录</button>
      </form>
    </section>
  </main>;
}
