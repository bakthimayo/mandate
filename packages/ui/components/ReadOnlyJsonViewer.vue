<template>
  <div class="audit-panel bg-slate-50 border border-slate-200 rounded-lg p-5 shadow-sm">
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
      <h3 class="text-sm font-medium text-slate-700 uppercase tracking-wider">Data Details</h3>
      <span v-if="displayHeight" class="text-xs text-slate-500">
        {{ lineCount }} lines
      </span>
    </div>
    
    <div 
      :style="displayHeight ? { maxHeight: displayHeight, overflowY: 'auto' } : {}"
      class="font-mono text-xs bg-white rounded border border-slate-200 p-4 text-slate-700 leading-relaxed"
    >
      <div class="space-y-0">
        <div
          v-for="(line, idx) in syntaxHighlightedLines"
          :key="idx"
          class="flex hover:bg-slate-50 transition-colors duration-75"
          :style="{ backgroundColor: getLineBg(rawLines[idx]) }"
        >
          <span class="w-8 select-none text-right text-slate-400 pr-4 text-xs flex-shrink-0 font-medium">
            {{ idx + 1 }}
          </span>
          <span class="flex-1 text-slate-600" v-html="line"></span>
        </div>
      </div>
    </div>

    <!-- Read-only indicator -->
    <p class="text-xs text-slate-500 mt-3 italic">
      Audit visibility only – direct editing is not permitted.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ComputedRef } from 'vue'

interface Props {
  data: Record<string, unknown> | unknown[]
  displayHeight?: string // e.g., "400px" or "60vh"
}

const props = withDefaults(defineProps<Props>(), {
  displayHeight: '400px'
})

/**
 * RFC-003: Read-only JSON viewer with syntax highlighting
 * No editing, no modifications, no copy-modify workflows
 * Syntax highlighting for audit visibility only
 */

const formattedJson: ComputedRef<string> = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2)
  } catch (e) {
    return '[Unable to serialize data]'
  }
})

const rawLines: ComputedRef<string[]> = computed(() => {
  return formattedJson.value.split('\n')
})

const lineCount: ComputedRef<number> = computed(() => {
  return rawLines.value.length
})

/**
 * Calculate indentation level and return background color
 * Subtle verdict-inspired coloring for audit console:
 * Level 0 (no indent): transparent
 * Level 1: subtle green (ALLOW)
 * Level 2: subtle amber (PAUSE)
 * Level 3: subtle red (BLOCK)
 * Level 4+: subtle slate (OBSERVE)
 */
const getLineBg = (line: string): string => {
  const indent = line.match(/^ */)?.[0].length || 0
  const level = Math.floor(indent / 2)
  
  const colors = [
    'transparent',                    // Level 0: no background
    'rgba(34, 197, 94, 0.04)',       // Level 1: green (ALLOW)
    'rgba(217, 119, 6, 0.04)',       // Level 2: amber (PAUSE)
    'rgba(239, 68, 68, 0.04)',       // Level 3: red (BLOCK)
    'rgba(100, 116, 139, 0.04)',     // Level 4+: slate (OBSERVE)
  ]
  
  return colors[level % colors.length]
}

/**
 * Simple HTML escaping for safe rendering
 * No syntax highlighting - prioritize readability
 */
const syntaxHighlightedLines: ComputedRef<string[]> = computed(() => {
  return rawLines.value.map((line) => {
    // Just escape HTML entities
    return line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  })
})
</script>

<style scoped>
/* Subtle scrollbar for audit console */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
