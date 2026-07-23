import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceStep } from './WorkspaceStep';

describe('WorkspaceStep', () => {
  afterEach(cleanup);
  it('renders upload as the current second workflow stage for UPLOADED tasks', () => {
    render(<WorkspaceStep status="UPLOADED" />);
    expect(screen.getByText('上传文件').closest('li')?.getAttribute('data-state')).toBe('current');
  });

  it('marks failed workspaces as failed without inventing a new task state', () => {
    render(<WorkspaceStep status="FAILED" />);
    expect(screen.getByLabelText('任务流程').getAttribute('data-failed')).toBe('true');
  });
});
