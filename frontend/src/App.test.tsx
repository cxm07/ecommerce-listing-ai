import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TaskListPage } from './pages';

describe('frontend workbench', () => {
  it('renders the task-centred workbench shell', () => {
    const html = renderToStaticMarkup(<MemoryRouter><TaskListPage /></MemoryRouter>);
    expect(html).toContain('商品上新任务');
    expect(html).toContain('新建任务');
    expect(html).toContain('审核工作台');
  });
});
