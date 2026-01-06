<template>
  <div class="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
    <pre class="text-green-400 font-mono text-sm">{{ formattedJson }}</pre>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: Record<string, unknown>
}

const props = defineProps<Props>()

const formattedJson = computed(() => {
  return JSON.stringify(props.data, null, 2)
})
</script>
