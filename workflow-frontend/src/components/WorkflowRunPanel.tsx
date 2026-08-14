import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import { useStepRunsSubscription } from './useStepRunsSubscription'

const TRIGGER_RUN = gql`
  mutation TriggerRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      workflow_run_id
      status
    }
  }
`

const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: uuid!) {
    approveStep(step_run_id: $step_run_id) {
      step_run_id
      status
    }
  }
`

type Props = {
  workflowId: string
  userRole: 'owner' | 'editor' | 'viewer'
  quotaUsed: number
  quotaLimit: number
}

export function WorkflowRunPanel({ workflowId, userRole, quotaUsed, quotaLimit }: Props) {
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null)
  const [triggerRun, { loading: triggering }] = useMutation(TRIGGER_RUN)
  const [approveStep, { loading: approving }] = useMutation(APPROVE_STEP)
  const { stepRuns, runStatus } = useStepRunsSubscription(workflowRunId)

  const quotaExhausted = quotaUsed >= quotaLimit

  async function handleRun() {
    const { data } = await triggerRun({ variables: { workflow_id: workflowId } })
    if (data?.triggerWorkflowRun?.workflow_run_id) {
      setWorkflowRunId(data.triggerWorkflowRun.workflow_run_id)
    }
  }

  async function handleApprove(stepRunId: string) {
    await approveStep({ variables: { step_run_id: stepRunId } })
  }

  return (
    <div className="workflow-run-panel">
      <div className="quota-indicator">
        Usage this period: {quotaUsed} / {quotaLimit}
        {quotaExhausted && <span className="quota-warning"> — quota exhausted</span>}
      </div>

      {userRole !== 'viewer' && (
        <button onClick={handleRun} disabled={triggering || quotaExhausted}>
          {triggering ? 'Starting...' : 'Run Workflow'}
        </button>
      )}

      {runStatus && <div className={`run-status run-status--${runStatus}`}>Run status: {runStatus}</div>}

      <ol className="step-run-list">
        {stepRuns.map((sr: any) => (
          <li key={sr.id} className={`step-run step-run--${sr.status}`}>
            <span className="step-type">{sr.workflow_step?.type}</span>
            <span className="step-status">{sr.status}</span>
            {sr.status === 'paused' && sr.workflow_step?.type === 'approval_gate' && (
              <div className="approval-gate">
                <p>Paused — awaiting approval</p>
                {(userRole === 'owner' || userRole === 'editor') && (
                  <button onClick={() => handleApprove(sr.id)} disabled={approving}>
                    {approving ? 'Approving...' : 'Approve & Resume'}
                  </button>
                )}
              </div>
            )}
            {sr.error && <div className="step-error">{sr.error}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}