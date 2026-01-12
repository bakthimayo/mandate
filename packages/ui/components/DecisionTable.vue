<template>
  <div class="audit-panel overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-100 border-b border-gray-200">
        <tr>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Timestamp
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Decision ID
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Intent
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Stage
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Spec ID
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Verdict
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Domain
          </th>
          <th class="px-4 py-2 text-left font-semibold text-gray-900">
            Agent / Service
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="decision in decisions"
          :key="decision.id"
          class="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition"
          @click="selectDecision(decision)"
        >
          <td class="px-4 py-3 text-gray-700">
            {{ formatTimestamp(decision.timestamp) }}
          </td>
          <td class="px-4 py-3 font-mono text-gray-600 truncate">
            {{ decision.id.slice(0, 8) }}...
          </td>
          <td class="px-4 py-3 text-gray-700">{{ decision.intent }}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-1 rounded text-xs font-medium" :class="stageClass(decision.stage)">
              {{ decision.stage }}
            </span>
          </td>
          <td class="px-4 py-3 font-mono text-xs text-gray-600 truncate">
            {{ decision.spec_id.slice(0, 12) }}...
          </td>
          <td class="px-4 py-3">
            <VerdictBadge :verdict="decision.verdict" />
          </td>
          <td class="px-4 py-3 text-gray-700">{{ decision.domain_name }}</td>
          <td class="px-4 py-3 text-gray-700">{{ decision.agent }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DecisionListItem, DecisionStage } from '~/types/mandate'

interface Props {
  decisions: DecisionListItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-decision': [decision: DecisionListItem]
}>()

const selectDecision = (decision: DecisionListItem) => {
  emit('select-decision', decision)
}

const formatTimestamp = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}

const stageClass = (stage: DecisionStage) => {
  switch (stage) {
    case 'INITIATED':
      return 'bg-blue-100 text-blue-800'
    case 'EVALUATED':
      return 'bg-yellow-100 text-yellow-800'
    case 'RESOLVED':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
</script>
