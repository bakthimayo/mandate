<template>
  <div class="audit-panel">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Verdict Explanation</h2>

    <div class="space-y-4">
      <!-- Verdict -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">VERDICT</p>
        <VerdictBadge :verdict="verdict.verdict" />
      </div>

      <!-- Policy Snapshot -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">POLICY SNAPSHOT ID</p>
        <p class="audit-text-mono">{{ verdict.policy_snapshot_id }}</p>
      </div>

      <!-- Matched Scopes -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">MATCHED SCOPES</p>
        <div class="space-y-1">
          <div
            v-for="scope in verdict.matched_scopes"
            :key="scope"
            class="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded"
          >
            {{ scope }}
          </div>
        </div>
      </div>

      <!-- Matched Policies -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">MATCHED POLICIES</p>
        <div class="space-y-1">
          <div
            v-for="policy in verdict.matched_policies"
            :key="policy"
            class="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded"
          >
            {{ policy }}
          </div>
        </div>
      </div>

      <!-- Explanation -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">EXPLANATION</p>
        <p class="text-sm text-gray-900 leading-relaxed">
          {{ verdict.explanation }}
        </p>
      </div>

      <!-- Precedence -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">
          PRECEDENCE ORDER
        </p>
        <p class="text-sm font-mono text-gray-700">
          #{{ verdict.precedence_order }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VerdictEvent } from '~/types/mandate'

interface Props {
  verdict: VerdictEvent
}

defineProps<Props>()
</script>
