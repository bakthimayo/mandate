<template>
  <div class="audit-panel">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Verdict Explanation</h2>

    <div class="space-y-4">
      <!-- Verdict -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">VERDICT</p>
        <VerdictBadge :verdict="verdict.verdict" />
      </div>

      <!-- Policy Snapshot ID -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">POLICY SNAPSHOT ID</p>
        <p class="audit-text-mono">{{ verdict.policy_snapshot_id }}</p>
      </div>

      <!-- Matched Scope IDs -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">MATCHED SCOPE IDS</p>
        <div v-if="verdict.matched_scopes?.length > 0" class="flex flex-wrap gap-2">
          <span
            v-for="scope in verdict.matched_scopes"
            :key="scope"
            class="inline-block px-2 py-1 bg-blue-50 text-blue-900 text-xs font-mono rounded border border-blue-100"
          >
            {{ scope }}
          </span>
        </div>
        <p v-else class="text-sm text-gray-500 italic">No scopes matched</p>
      </div>

      <!-- Matched Policy IDs -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">MATCHED POLICY IDS</p>
        <div v-if="verdict.matched_policies?.length > 0" class="space-y-1">
          <div
            v-for="policy in verdict.matched_policies"
            :key="policy"
            class="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded font-mono"
          >
            {{ policy }}
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 italic">No policies matched</p>
      </div>

      <!-- Explanation Text -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-2">EXPLANATION</p>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ verdict.explanation }}</p>
        </div>
      </div>

      <!-- Verdict Precedence -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">VERDICT PRECEDENCE</p>
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
            #{{ verdict.precedence_order }}
          </span>
          <span class="text-xs text-gray-500">
            ({{ getPrecedenceLabel(verdict.precedence_order) }})
          </span>
        </div>
      </div>

      <!-- Timestamp -->
      <div class="border-t pt-4">
        <p class="text-xs text-gray-600 font-medium mb-1">ISSUED AT</p>
        <p class="text-sm text-gray-700">{{ formatTimestamp(verdict.timestamp) }}</p>
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

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString()
  } catch {
    return timestamp
  }
}

const getPrecedenceLabel = (order: number): string => {
  if (order === 1) return 'highest priority'
  if (order <= 3) return 'high priority'
  if (order <= 10) return 'medium priority'
  return 'lower priority'
}
</script>
