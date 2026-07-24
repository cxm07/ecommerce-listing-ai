import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  afterEach(cleanup);

  it('keeps product-facing environment copy and exposes a semantic page container', () => {
    render(
      <MemoryRouter>
        <AppShell eyebrow="任务中心" title="商品上新任务">
          <p>工作内容</p>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('演示环境')).not.toBeNull();
    expect(screen.queryByText(/Mock|API|适配器/i)).toBeNull();
    expect(screen.queryByTestId('current-user-role')).toBeNull();
    expect(screen.getByRole('main').id).toBe('main-content');
  });
});
