<template>
  <div class="timeline-entry">
    <div class="timeline-marker">
      <span class="text-gray-600 text-lg">📋</span>
    </div>

    <div class="ml-16 audit-panel">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="font-semibold text-gray-900">
            {{ entry.summary }}
          </h3>
          <p class="text-xs text-gray-500 mt-1">
            {{ formatTimestamp(entry.timestamp) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-xs font-medium text-gray-700">
            {{ entry.source }}
          </p>
          <p class="text-xs text-gray-500">
            {{ entry.authority_level }}
          </p>
        </div>
      </div>

      <!-- Expandable Details -->
      <div v-if="expanded" class="mt-4 space-y-3">
        <div v-if="entry.type" class="text-xs">
          <p class="text-gray-600 font-medium">Type</p>
          <p class="text-gray-900 mt-1">{{ entry.type }}</p>
        </div>

        <div class="text-xs">
          <button
            @click="showJson = !showJson"
            class="text-blue-600 hover:underline font-medium"
          >
            {{ showJson ? 'Hide' : 'Show' }} Details (JSON)
          </button>
          <div v-if="showJson" class="mt-2">
            <JsonViewer :data="entry.details" />
          </div>
        </div>
      </div>

      <!-- Toggle Button -->
      <button
        @click="expanded = !expanded"
        class="mt-2 text-xs text-blue-600 hover:underline font-medium"
      >
        {{ expanded ? 'Collapse' : 'Expand' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEntry } from '~/types/mandate'

interface Props {
  entry: TimelineEntry
}

const props = defineProps<Props>()

const expanded = ref(false)
const showJson = ref(false)

const formatTimestamp = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}
</script>
