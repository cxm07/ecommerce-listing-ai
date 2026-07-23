import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { createMockAuthRepository } from './mockAuthRepository';
import { notifyUnauthorized } from './authEvents';

afterEach(cleanup);

function renderApp(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App authRepository={createMockAuthRepository()} /></MemoryRouter>);
}

describe('authenticated application routes', () => {
  it('redirects an anonymous visitor to login and restores the requested page after sign in', async () => {
    const user = userEvent.setup();
    renderApp('/tasks/task-demo/products');

    await screen.findByTestId('login-page');
    await user.click(screen.getByRole('button', { name: '使用演示身份登录' }));

    expect(await screen.findByTestId('product-review-page')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '审核商品通过' })).toBeNull();
    expect(await screen.findByText('商品修正完成后，将由审核人员确认通过。')).toBeTruthy();
  });

  it('shows the signed-in user role and returns to login after logout', async () => {
    const user = userEvent.setup();
    renderApp('/tasks');

    await screen.findByTestId('login-page');
    await user.click(screen.getByRole('button', { name: '使用演示身份登录' }));
    expect((await screen.findByTestId('current-user-role')).textContent).toBe('运营人员');

    await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(await screen.findByTestId('login-page')).toBeTruthy();
  });

  it('returns to login when the API reports an unauthorized session', async () => {
    const user = userEvent.setup();
    renderApp('/tasks');

    await screen.findByTestId('login-page');
    await user.click(screen.getByRole('button', { name: '使用演示身份登录' }));
    await screen.findByTestId('task-list-page');

    notifyUnauthorized();
    expect(await screen.findByTestId('login-page')).toBeTruthy();
  });

  it('renders a dedicated forbidden page', async () => {
    renderApp('/forbidden');
    expect(await screen.findByTestId('forbidden-page')).toBeTruthy();
  });
});
