import type { TaskStatus } from '../domain/contracts';
import { getWorkflowStepIndex, workflowSteps } from '../domain/workflow';

export function WorkspaceStep({ status }: { status: TaskStatus }) {
  const current = getWorkflowStepIndex(status);
  return <ol aria-label="任务流程" className="workspace-stepper" data-failed={status === 'FAILED' ? 'true' : undefined}>{workflowSteps.map((step, index) => {
    const state = status === 'FAILED' && index === current ? 'failed' : index < current ? 'complete' : index === current ? 'current' : 'upcoming';
    return <li data-state={state} key={step.status}>
      <div className="workflow-step-node" data-step-node>
        <span aria-hidden="true">{index + 1}</span>
        <b>{step.label}</b>
      </div>
      {index < workflowSteps.length - 1 ? <i aria-hidden="true" data-step-connector /> : null}
    </li>;
  })}</ol>;
}
