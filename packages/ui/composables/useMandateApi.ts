/**
 * useMandateApi - Read-only API composable
 * RFC-003 Constraint: GET requests only. No mutations.
 */

import type {
  DecisionListItem,
  DecisionTimeline,
  ApiError
} from '~/types/mandate'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
}

const normalizeStage = (stage: string): 'INITIATED' | 'EVALUATED' | 'RESOLVED' => {
   if (!stage) return 'INITIATED'
   const s = stage.toLowerCase()
   if (s === 'executed' || s === 'resolved') return 'RESOLVED'
   if (s === 'evaluated') return 'EVALUATED'
   return 'INITIATED'
 }

export const useMandateApi = () => {
   const config = useRuntimeConfig()
   const apiBase = config.public.apiBase

  /**
   * Fetch decision list with optional filters
   * GET /api/v1/decisions
   */
  const fetchDecisions = async (params?: {
    timeRange?: { start: string; end: string }
    verdict?: string
    intent?: string
    agent?: string
    organizationId?: string
    domain?: string
  }): Promise<ApiState<DecisionListItem[]>> => {
    const state: ApiState<DecisionListItem[]> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/decisions`)
      if (params) {
        if (params.timeRange) {
          url.searchParams.append('startTime', params.timeRange.start)
          url.searchParams.append('endTime', params.timeRange.end)
        }
        if (params.verdict) url.searchParams.append('verdict', params.verdict)
        if (params.intent) url.searchParams.append('intent', params.intent)
        if (params.agent) url.searchParams.append('agent', params.agent)
        if (params.organizationId)
          url.searchParams.append('organization_id', params.organizationId)
        if (params.domain) url.searchParams.append('domain', params.domain)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch decisions: ${response.statusText}`
        }
        return state
      }

      const json = await response.json()
      const decisions = (json.decisions || json) as any[]
      // Transform server response to match DecisionListItem type
      state.data = decisions.map((d: any) => ({
        id: d.decision_id,
        timestamp: d.timestamp,
        intent: d.intent,
        stage: normalizeStage(d.stage),
        verdict: d.verdict || 'OBSERVE',
        agent: d.actor || d.scope?.service || '',
        target: d.target || '',
        policy_snapshot_id: d.policy_snapshot_id || '',
        organization_id: d.organization_id,
        domain: d.scope?.domain || d.domain || ''
      }))
    } catch (err) {
      state.error = {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    } finally {
      state.loading = false
    }

    return state
  }

  /**
   * Fetch domains for an organization
   * GET /api/v1/domains
   */
  const fetchDomains = async (
    organizationId: string
  ): Promise<ApiState<{ domain_id: string; name: string }[]>> => {
    const state: ApiState<{ domain_id: string; name: string }[]> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/domains`)
      url.searchParams.append('organization_id', organizationId)

      const response = await fetch(url.toString())
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch domains: ${response.statusText}`
        }
        return state
      }

      const data = await response.json()
      state.data = data.domains
    } catch (err) {
      state.error = {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    } finally {
      state.loading = false
    }

    return state
  }

  /**
   * Fetch full decision timeline
   * GET /api/v1/decisions/:decisionId/timeline?organization_id=...&domain=...
   */
  const fetchDecisionTimeline = async (
    decisionId: string,
    organizationId?: string,
    domain?: string
  ): Promise<ApiState<DecisionTimeline>> => {
    const state: ApiState<DecisionTimeline> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/decisions/${decisionId}/timeline`)
      if (organizationId) {
        url.searchParams.append('organization_id', organizationId)
      }
      if (domain) {
        url.searchParams.append('domain', domain)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch decision: ${response.statusText}`
        }
        return state
      }

      state.data = await response.json()
    } catch (err) {
      state.error = {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    } finally {
      state.loading = false
    }

    return state
  }

  return {
    fetchDecisions,
    fetchDomains,
    fetchDecisionTimeline
  }
}
