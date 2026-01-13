/**
 * useMandateApi - Read-only API composable
 * RFC-003 Constraint: GET requests only. No mutations.
 */

import type {
   DecisionListItem,
   DecisionTimeline,
   ApiError,
   SpecDefinition,
   PolicyDefinition
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
    domain_name?: string
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
        if (params.domain_name) url.searchParams.append('domain_name', params.domain_name)
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
        spec_id: d.spec_id || '',
        policy_snapshot_id: d.policy_snapshot_id || '',
        organization_id: d.organization_id,
        domain_name: d.scope?.domain_name || d.domain_name || ''
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
  ): Promise<ApiState<{ domain_name: string }[]>> => {
    const state: ApiState<{ domain_name: string }[]> = {
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
   * GET /api/v1/decisions/:decisionId/timeline?organization_id=...&domain_name=...
   */
  const fetchDecisionTimeline = async (
    decisionId: string,
    organizationId?: string,
    domain_name?: string
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
      if (domain_name) {
        url.searchParams.append('domain_name', domain_name)
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

  /**
    * Fetch spec details by spec_id and version
    * GET /api/v1/specs/:spec_id?version=...
    */
  const fetchSpec = async (
    specId: string,
    version: string
  ): Promise<ApiState<SpecDefinition>> => {
    const state: ApiState<SpecDefinition> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/specs/${specId}`)
      url.searchParams.append('version', version)
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch spec: ${response.statusText}`
        }
        return state
      }

      const json = await response.json()
      const spec = json.spec || json
      
      // Transform server response to match SpecDefinition type
      state.data = {
        spec_id: spec.spec_id,
        intent: spec.intent,
        stage: spec.stage,
        version: spec.version,
        domain_name: spec.domain_name,
        allowed_verdicts: spec.allowed_verdicts,
        signals: spec.signals || [],
        signals_declared: spec.signals ? 
          spec.signals.reduce((acc: Record<string, string>, s: any) => {
            acc[s.name] = s.type
            return acc
          }, {}) : {}
      }
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
   * Fetch policy details from a snapshot
   * GET /api/v1/policy-snapshots/:snapshot_id/policies?policy_id=...&organization_id=...&domain_name=...
   * If policy_id not provided, returns all policies
   */
  const fetchPolicy = async (
    snapshotId: string,
    policyId: string,
    organizationId: string,
    domainName: string
  ): Promise<ApiState<PolicyDefinition>> => {
    const state: ApiState<PolicyDefinition> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/policy-snapshots/${snapshotId}/policies`)
      url.searchParams.append('policy_id', policyId)
      url.searchParams.append('organization_id', organizationId)
      url.searchParams.append('domain_name', domainName)
      
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch policy: ${response.statusText}`
        }
        return state
      }

      const json = await response.json()
      const policy = json.policy || json
      
      // Transform server response to match PolicyDefinition type
      state.data = {
        id: policy.id || policyId,
        verdict: policy.verdict,
        conditions: policy.conditions || [],
        explanation: policy.explanation
      }
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
   * Fetch all policies from a snapshot
   * GET /api/v1/policy-snapshots/:snapshot_id/policies?organization_id=...&domain_name=...
   */
  const fetchAllPolicies = async (
    snapshotId: string,
    organizationId: string,
    domainName: string
  ): Promise<ApiState<PolicyDefinition[]>> => {
    const state: ApiState<PolicyDefinition[]> = {
      data: null,
      loading: true,
      error: null
    }

    try {
      const url = new URL(`${apiBase}/policy-snapshots/${snapshotId}/policies`)
      url.searchParams.append('organization_id', organizationId)
      url.searchParams.append('domain_name', domainName)
      
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        state.error = {
          code: 'FETCH_ERROR',
          message: `Failed to fetch policies: ${response.statusText}`
        }
        return state
      }

      const json = await response.json()
      const policies = json.policies || []
      
      // Transform server response to match PolicyDefinition type
      state.data = policies.map((policy: any) => ({
        id: policy.id,
        verdict: policy.verdict,
        conditions: policy.conditions || [],
        explanation: policy.explanation
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

  return {
    fetchDecisions,
    fetchDomains,
    fetchDecisionTimeline,
    fetchSpec,
    fetchPolicy,
    fetchAllPolicies
  }
  }
