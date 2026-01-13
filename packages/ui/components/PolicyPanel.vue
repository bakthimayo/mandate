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
        <h2 class="text-lg font-semibold text-gray-900">Policy Details</h2>
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
          <p class="text-gray-600">Loading policy details...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-6 bg-red-50 border-b border-red-200">
          <p class="text-red-900 font-medium text-sm">{{ error.message }}</p>
        </div>

        <!-- Policy Details -->
        <div v-else-if="policy" class="p-6 space-y-6">
          <!-- Policy ID -->
          <div>
            <p class="text-xs text-gray-600 font-medium mb-1">POLICY ID</p>
            <p class="audit-text-mono text-sm text-gray-900">{{ policy.id }}</p>
          </div>

          <!-- Verdict -->
          <div>
            <p class="text-xs text-gray-600 font-medium mb-2">VERDICT</p>
            <span
              class="inline-block px-3 py-1 rounded text-sm font-medium"
              :class="getVerdictClass(policy.verdict)"
            >
              {{ policy.verdict }}
            </span>
          </div>

          <!-- Conditions -->
          <div v-if="policy.conditions && policy.conditions.length > 0" class="border-t pt-4">
            <p class="text-xs text-gray-600 font-medium mb-3">CONDITIONS</p>
            <div class="space-y-2">
              <div
                v-for="(condition, idx) in policy.conditions"
                :key="idx"
                class="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-1"
              >
                <p class="text-gray-700">
                  <span class="font-medium">{{ condition.signal }}</span>
                  <span class="text-gray-600 mx-1">{{ condition.operator }}</span>
                  <span class="font-mono text-gray-700">{{ formatConditionValue(condition.value) }}</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Explanation -->
          <div v-if="policy.explanation" class="border-t pt-4">
            <p class="text-xs text-gray-600 font-medium mb-2">EXPLANATION</p>
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
              <p class="text-sm text-gray-900 leading-relaxed">
                {{ policy.explanation }}
              </p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="p-6 text-center">
          <p class="text-gray-600">Policy not found</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PolicyDefinition } from '~/types/mandate'

interface Props {
  isOpen: boolean
  policyId?: string
  snapshotId?: string
  organizationId?: string
  domainName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  policyId: undefined,
  snapshotId: undefined,
  organizationId: undefined,
  domainName: undefined
})

const emit = defineEmits<{
  close: []
}>()

const { fetchPolicy } = useMandateApi()

const policy = ref<PolicyDefinition | null>(null)
const loading = ref(false)
const error = ref<{ message: string } | null>(null)

const onClose = () => {
  policy.value = null
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

const formatConditionValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (Array.isArray(value)) return `[${value.join(', ')}]`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

watch(
  () => [props.isOpen, props.policyId, props.snapshotId, props.organizationId, props.domainName],
  async ([newIsOpen, newPolicyId, newSnapshotId, newOrgId, newDomainName]) => {
    if (newIsOpen && newPolicyId && newSnapshotId && newOrgId && newDomainName) {
      loading.value = true
      error.value = null
      policy.value = null

      const result = await fetchPolicy(newSnapshotId, newPolicyId, newOrgId, newDomainName)
      policy.value = result.data
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
