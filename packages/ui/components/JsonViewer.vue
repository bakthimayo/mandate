<!-- Deprecated: Use ReadOnlyJsonViewer.vue instead -->
<!-- This component is maintained for backward compatibility -->
<template>
  <ReadOnlyJsonViewer :data="data" display-height="400px" />
</template>

<script setup lang="ts">
interface Props {
  data: Record<string, unknown> | unknown[]
}

defineProps<Props>()
</script>
