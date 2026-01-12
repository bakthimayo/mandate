<template>
  <div class="audit-panel">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

    <div class="space-y-4">
      <!-- Organization (Static/Read-only) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Organization ID
        </label>
        <div class="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-600 font-mono truncate">
          {{ organizationId }}
        </div>
      </div>

      <!-- Domain Dropdown -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Domain <span class="text-red-500">*</span>
        </label>
        <div v-if="loadingDomains" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-500">
          Loading domains...
        </div>
        <div v-else-if="domainsError" class="w-full px-3 py-2 border border-red-300 rounded-md text-sm text-red-600 bg-red-50">
          {{ domainsError }}
        </div>
        <select
          v-else
          class="w-full px-3 py-2 border rounded-md text-sm"
          :class="!filters.domain ? 'border-red-300 bg-red-50' : 'border-gray-300'"
          :value="filters.domain"
          @change="updateFilter('domain', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select a domain</option>
          <option v-for="d in domains" :key="d.domain_name" :value="d.domain_name">
            {{ d.domain_name }}
          </option>
        </select>
        <p v-if="!filters.domain && !loadingDomains && !domainsError" class="text-xs text-red-500 mt-1">
          Domain is required
        </p>
      </div>

      <!-- Time Range -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Time Range
        </label>
        <div class="space-y-2">
          <input
            type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            :value="filters.startTime"
            @input="updateFilter('startTime', ($event.target as HTMLInputElement).value)"
            placeholder="Start time"
          />
          <input
            type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            :value="filters.endTime"
            @input="updateFilter('endTime', ($event.target as HTMLInputElement).value)"
            placeholder="End time"
          />
        </div>
      </div>

      <!-- Verdict Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Verdict
        </label>
        <select
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          :value="filters.verdict"
          @change="updateFilter('verdict', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">All Verdicts</option>
          <option value="ALLOW">Allow</option>
          <option value="PAUSE">Pause</option>
          <option value="BLOCK">Block</option>
          <option value="OBSERVE">Observe</option>
        </select>
      </div>

      <!-- Intent Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Intent
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          :value="filters.intent"
          @input="updateFilter('intent', ($event.target as HTMLInputElement).value)"
          placeholder="Filter by intent..."
        />
      </div>

      <!-- Agent/Service Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Agent / Service
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          :value="filters.agent"
          @input="updateFilter('agent', ($event.target as HTMLInputElement).value)"
          placeholder="Filter by agent..."
        />
      </div>

      <!-- Apply Filters Button -->
      <button
        @click="applyFilters"
        :disabled="!canApply"
        class="w-full px-4 py-2 rounded-md text-sm font-medium transition"
        :class="canApply ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'"
      >
        Apply Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FilterState {
  startTime: string
  endTime: string
  verdict: string
  intent: string
  agent: string
  domain: string
}

interface DomainItem {
  domain_name: string
}

const config = useRuntimeConfig()
const organizationId = config.public.organizationId as string

const { fetchDomains } = useMandateApi()
const { loadFilters } = useFilterStore()

const domains = ref<DomainItem[]>([])
const loadingDomains = ref(true)
const domainsError = ref<string | null>(null)

const filters = reactive<FilterState>({
  startTime: '',
  endTime: '',
  verdict: '',
  intent: '',
  agent: '',
  domain: ''
})

const emit = defineEmits<{
  'apply-filters': [filters: FilterState & { organizationId: string }]
}>()

const updateFilter = (key: keyof FilterState, value: string) => {
  filters[key] = value
}

const canApply = computed(() => {
  return filters.domain.trim() !== ''
})

const applyFilters = () => {
  if (!canApply.value) return
  emit('apply-filters', { ...filters, organizationId })
}

onMounted(async () => {
  loadingDomains.value = true
  domainsError.value = null

  const result = await fetchDomains(organizationId)

  if (result.error) {
    domainsError.value = result.error.message
  } else {
    domains.value = result.data || []
  }

  // Restore cached filters after domains are loaded
  const cachedFilters = loadFilters()
  if (cachedFilters) {
    filters.domain = cachedFilters.domain || ''
    filters.startTime = cachedFilters.startTime || ''
    filters.endTime = cachedFilters.endTime || ''
    filters.verdict = cachedFilters.verdict || ''
    filters.intent = cachedFilters.intent || ''
    filters.agent = cachedFilters.agent || ''
  }

  loadingDomains.value = false
})
</script>
