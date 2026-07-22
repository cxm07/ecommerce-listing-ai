import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TaskListPage } from './pages'

describe('frontend foundation', () => {
  it('renders the task list page with expected content', () => {
    const html = renderToStaticMarkup(<TaskListPage />)

    expect(html).toContain('任务列表')
    expect(html).toContain('公共基线占位页面')
  })
})
