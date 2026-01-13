<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-hidden"
    @click.self="onClose"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50 transition-opacity" />

    <!-- Panel -->
    <div
      class="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <!-- Header -->
      <div class="border-b border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Spec Details</h2>
        <button
          @click="onClose"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close panel"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto h-full pb-20">
        <!-- Loading State -->
        <div v-if="loading" class="p-6 text-center">
          <p class="text-gray-600">Loading spec details...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-6 bg-red-50 border-b border-red-200">
          <p class="text-red-900 font-medium text-sm">{{ error.message }}</p>
        </div>

        <!-- Spec Details -->
        <div v-else-if="spec" class="p-6 space-y-6">
          <!-- Basic Info -->
          <div class="space-y-4">
            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">SPEC ID</p>
              <p class="audit-text-mono text-sm text-gray-900">{{ spec.spec_id }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">VERSION</p>
              <p class="text-sm text-gray-900">{{ spec.version }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">DOMAIN</p>
              <p class="text-sm text-gray-900">{{ spec.domain_name }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">INTENT</p>
              <p class="text-sm text-gray-900">{{ spec.intent }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">STAGE</p>
              <p class="text-sm text-gray-900">{{ spec.stage }}</p>
            </div>
          </div>

          <!-- Allowed Verdicts -->
          <div class="border-t pt-4">
            <p class="text-xs text-gray-600 font-medium mb-3">ALLOWED VERDICTS</p>
            <div class="flex gap-2 flex-wrap">
              <span
                v-for="verdict in parsedVerdicts"
                :key="verdict"
                class="px-2 py-1 rounded text-xs font-medium"
                :class="getVerdictClass(verdict)"
              >
                {{ verdict }}
              </span>
            </div>
          </div>

          <!-- Signals -->
          <div v-if="spec.signals && spec.signals.length > 0" class="border-t pt-4">
            <p class="text-xs text-gray-600 font-medium mb-3">SIGNALS</p>
            <div class="space-y-3">
              <div
                v-for="signal in spec.signals"
                :key="signal.name"
                class="bg-gray-50 p-3 rounded border border-gray-200"
              >
                <div class="flex items-start justify-between mb-2">
                  <p class="text-xs font-medium text-gray-900">{{ signal.name }}</p>
                  <span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                    {{ signal.type }}
                  </span>
                </div>
                <p class="text-xs text-gray-600 mb-2">{{ signal.description }}</p>
                <div class="flex gap-2 text-xs text-gray-500">
                  <span v-if="signal.required" class="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Required
                  </span>
                  <span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                    {{ signal.source }}
                  </span>
                </div>
                <div v-if="signal.values && signal.values.length > 0" class="mt-2">
                  <p class="text-xs font-medium text-gray-700 mb-1">Values:</p>
                  <div class="flex gap-1 flex-wrap">
                    <span
                      v-for="val in signal.values"
                      :key="val"
                      class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
                    >
                      {{ val }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No signals -->
          <div v-else class="border-t pt-4">
            <p class="text-xs text-gray-600 font-medium mb-2">SIGNALS</p>
            <p class="text-xs text-gray-500">No signals declared</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="p-6 text-center">
          <p class="text-gray-600">Spec not found</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SpecDefinition } from '~/types/mandate'

interface Props {
  isOpen: boolean
  specId?: string
  version?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  specId: undefined,
  version: undefined
})

const emit = defineEmits<{
  close: []
}>()

const { fetchSpec } = useMandateApi()

const spec = ref<SpecDefinition | null>(null)
const loading = ref(false)
const error = ref<{ message: string } | null>(null)

const parsedVerdicts = computed(() => {
  if (!spec.value?.allowed_verdicts) return []
  
  const verdicts = spec.value.allowed_verdicts
  
  // If it's an array, return as-is
  if (Array.isArray(verdicts)) {
    return verdicts
  }
  
  // If it's a string like "{ALLOW,PAUSE,BLOCK,OBSERVE}", parse it
  if (typeof verdicts === 'string') {
    return verdicts
      .replace(/[{}]/g, '') // Remove curly braces
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)
  }
  
  return []
})

const onClose = () => {
  spec.value = null
  error.value = null
  emit('close')
}

const getVerdictClass = (verdict: string) => {
  switch (verdict) {
    case 'ALLOW':
      return 'bg-green-100 text-green-800'
    case 'BLOCK':
      return 'bg-red-100 text-red-800'
    case 'PAUSE':
      return 'bg-yellow-100 text-yellow-800'
    case 'OBSERVE':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

watch(
  () => [props.isOpen, props.specId, props.version],
  async ([newIsOpen, newSpecId, newVersion]) => {
    if (newIsOpen && newSpecId && newVersion) {
      loading.value = true
      error.value = null
      spec.value = null

      const result = await fetchSpec(newSpecId, newVersion)
      spec.value = result.data
      error.value = result.error
      loading.value = false
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.audit-text-mono {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  word-break: break-all;
}
</style>
