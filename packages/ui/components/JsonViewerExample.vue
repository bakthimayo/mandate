<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">ReadOnlyJsonViewer Component</h1>
      <p class="text-gray-600">
        RFC-003 compliant read-only JSON viewer for audit visibility. No editing, no inline modifications, syntax highlighting only.
      </p>
    </div>

    <!-- Example 1: Decision Event JSON -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Example 1: Decision Event Details</h2>
      <ReadOnlyJsonViewer :data="exampleDecisionEvent" display-height="300px" />
    </section>

    <!-- Example 2: Timeline Entry JSON -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Example 2: Timeline Entry Details</h2>
      <ReadOnlyJsonViewer :data="exampleTimelineEntry" display-height="250px" />
    </section>

    <!-- Example 3: Verdict Event JSON -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Example 3: Verdict Event Details</h2>
      <ReadOnlyJsonViewer :data="exampleVerdictEvent" display-height="280px" />
    </section>

    <!-- Example 4: Array Data -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Example 4: Array Data (Matched Policies)</h2>
      <ReadOnlyJsonViewer :data="exampleArrayData" display-height="200px" />
    </section>

    <!-- RFC-003 Compliance Note -->
    <div class="audit-panel bg-blue-50 border-blue-200">
      <h3 class="text-sm font-semibold text-blue-900 mb-2">RFC-003 Compliance</h3>
      <ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
        <li>Strictly read-only - no POST/PUT/PATCH/DELETE capability</li>
        <li>Syntax highlighting for audit visibility only</li>
        <li>No copy-modify workflows</li>
        <li>No editing affordances</li>
        <li>Renders persisted data exactly as provided</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// Example data structures matching Mandate API responses
const exampleDecisionEvent = ref({
  id: 'dec_f5e7c19a',
  timestamp: '2026-01-06T14:32:21.847Z',
  organization_id: 'org_2a4b8f5c',
  domain: 'api.example.com',
  intent: 'create_resource',
  stage: 'EVALUATED',
  context: {
    user_id: 'usr_9d3f2b1a',
    resource_type: 'database_backup',
    region: 'us-west-2',
    cost_estimate: 2500
  },
  metadata: {
    source: 'terraform',
    request_id: 'req_7f3a2b9c',
    trace_id: '4bf92f3577b34da6a3ce929d0e0e4736'
  }
})

const exampleTimelineEntry = ref({
  id: 'tl_a8f2e5b3',
  timestamp: '2026-01-06T14:32:21.851Z',
  source: 'control_plane',
  authority_level: 'system',
  summary: 'Policy evaluation completed - cost limit check triggered BLOCK verdict',
  type: 'verdict',
  details: {
    policy_id: 'pol_cost_limit_v3',
    evaluation_ms: 125,
    matched_conditions: 2,
    cost_threshold: 5000,
    estimated_cost: 2500
  }
})

const exampleVerdictEvent = ref({
  id: 'vrd_c3e7f1a9',
  decision_id: 'dec_f5e7c19a',
  timestamp: '2026-01-06T14:32:21.851Z',
  verdict: 'PAUSE',
  policy_snapshot_id: 'snap_pol_2026_01_06_v2',
  matched_scopes: ['org_2a4b8f5c', 'domain_api_example_com'],
  matched_policies: ['pol_cost_limit_v3', 'pol_approval_required_prod'],
  explanation: 'Decision paused: Cost estimate ($2,500) is within limits but requires management approval for production resource creation. Matched policies require human review for database operations in prod environment.',
  precedence_order: 2
})

const exampleArrayData = ref([
  'pol_cost_limit_v3',
  'pol_approval_required_prod',
  'pol_region_compliance_usw2',
  'pol_backup_retention_90d'
])
</script>

<style scoped>
section {
  @apply border-b border-gray-200 pb-6 last:border-b-0;
}
</style>
