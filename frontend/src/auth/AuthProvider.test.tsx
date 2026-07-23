import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthProvider, useAuth } from './AuthProvider';
import { notifyUnauthorized } from './authEvents';
import { createMockAuthRepository } from './mockAuthRepository';

function Probe() {
  const auth = useAuth();
  return <>
    <p data-testid="status">{auth.status}</p>
    <p data-testid="email">{auth.session?.user.email ?? 'none'}</p>
    <button onClick={() => void auth.signIn({ email: 'demo@example.invalid' })}>登录</button>
    <button onClick={() => void auth.signOut()}>退出</button>
  </>;
}

describe('AuthProvider', () => {
  afterEach(cleanup);

  it('loads the mock session only after an explicit sign-in', async () => {
    render(<AuthProvider repository={createMockAuthRepository()}><Probe /></AuthProvider>);

    await screen.findByText('anonymous');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('email').textContent).toBe('demo@example.invalid');
  });

  it('clears the active session after an unauthorized event', async () => {
    render(<AuthProvider repository={createMockAuthRepository()}><Probe /></AuthProvider>);

    await screen.findByText('anonymous');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    notifyUnauthorized();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('email').textContent).toBe('none');
  });
});
