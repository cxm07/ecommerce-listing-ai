import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NavigationItem } from './NavigationItem';

describe('NavigationItem', () => {
  it('marks the task center item as current for its URL', () => {
    render(<MemoryRouter initialEntries={['/tasks']}><NavigationItem to="/tasks" label="任务中心" activeWhen={(pathname) => pathname === '/tasks'} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '任务中心' }).getAttribute('aria-current')).toBe('page');
  });
});
