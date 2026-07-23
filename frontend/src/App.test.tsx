import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { NewTaskPage, TaskListPage } from './pages';

describe('frontend workbench', () => {
  afterEach(cleanup);

  it('redirects an unauthenticated task route to the login screen', async () => {
    render(<MemoryRouter initialEntries={['/tasks']}><App /></MemoryRouter>);
    expect(await screen.findByTestId('login-page')).toBeTruthy();
  });

  it('renders the task-centred workbench shell', () => {
    const html = renderToStaticMarkup(<MemoryRouter><TaskListPage /></MemoryRouter>);
    expect(html).toContain('商品上新任务');
    expect(html).toContain('新建任务');
    expect(html).toContain('审核工作台');
  });

  it('labels the data source instead of claiming every new task is a mock', () => {
    const html = renderToStaticMarkup(<MemoryRouter><NewTaskPage /></MemoryRouter>);
    expect(html).toContain('当前数据源：本地 Mock 适配器');
  });

  it('shows the shared workflow progress at task creation', () => {
    const html = renderToStaticMarkup(<MemoryRouter><NewTaskPage /></MemoryRouter>);
    expect(html).toContain('任务流程');
    expect(html).toContain('创建任务');
  });
});
