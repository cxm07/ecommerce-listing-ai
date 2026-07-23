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

  it('explains the fixed import template without exposing adapter implementation details', () => {
    const html = renderToStaticMarkup(<MemoryRouter><NewTaskPage /></MemoryRouter>);
    expect(html).toContain('当前使用固定的 MVP 商品导入模板');
    expect(html).not.toContain('当前数据源');
  });

  it('shows the shared workflow progress at task creation', () => {
    const html = renderToStaticMarkup(<MemoryRouter><NewTaskPage /></MemoryRouter>);
    expect(html).toContain('任务流程');
    expect(html).toContain('创建任务');
  });
});
