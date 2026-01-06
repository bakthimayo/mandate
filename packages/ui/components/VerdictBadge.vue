<template>
  <span :class="['audit-badge border', verdictClass]">
    {{ verdict }}
  </span>
</template>

<script setup lang="ts">
import type { Verdict } from '~/types/mandate'

interface Props {
  verdict: Verdict
}

const props = defineProps<Props>()

const verdictClass = computed(() => {
  switch (props.verdict) {
    case 'ALLOW':
      return 'verdict-allow'
    case 'PAUSE':
      return 'verdict-pause'
    case 'BLOCK':
      return 'verdict-block'
    case 'OBSERVE':
      return 'verdict-observe'
    default:
      return 'verdict-observe'
  }
})
</script>
