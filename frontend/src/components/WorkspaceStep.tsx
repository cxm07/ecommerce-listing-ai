import type { TaskStatus } from '../domain/contracts';
import { getWorkflowStepIndex, workflowSteps } from '../domain/workflow';

export function WorkspaceStep({ status }: { status: TaskStatus }) {
  const current = getWorkflowStepIndex(status);
  return <ol aria-label="任务流程" className="workspace-stepper" data-failed={status === 'FAILED' ? 'true' : undefined}>{workflowSteps.map((step, index) => {
    const state = status === 'FAILED' && index === current ? 'failed' : index < current ? 'complete' : index === current ? 'current' : 'upcoming';
    return <li data-state={state} key={step.status}><span>{index + 1}</span><b>{step.label}</b></li>;
  })}</ol>;
}
