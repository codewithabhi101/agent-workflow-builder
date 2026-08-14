import { useSubscription, gql } from '@apollo/client'

const STEP_RUNS_SUBSCRIPTION = gql`
  subscription StepRuns($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { started_at: asc }
    ) {
      id
      status
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      workflow_step {
        step_order
        type
      }
    }
    workflow_runs_by_pk(id: $workflow_run_id) {
      id
      status
      current_step_order
    }
  }
`

export function useStepRunsSubscription(workflowRunId: string | null) {
  const { data, loading, error } = useSubscription(STEP_RUNS_SUBSCRIPTION, {
    variables: { workflow_run_id: workflowRunId },
    skip: !workflowRunId
  })

  return {
    stepRuns: data?.step_runs ?? [],
    runStatus: data?.workflow_runs_by_pk?.status ?? null,
    loading,
    error
  }
}