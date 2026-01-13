<template>
  <div class="space-y-6">
    <!-- Layout: Filters + Table -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Filters Panel -->
      <div class="lg:col-span-1">
        <DecisionFilters @apply-filters="applyFilters" />
      </div>

      <!-- Results Panel -->
      <div class="lg:col-span-4">
        <!-- Loading State -->
        <div v-if="loading" class="audit-panel text-center py-8">
          <p class="text-gray-600">Loading decisions...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="audit-panel bg-red-50 border-red-200">
          <p class="text-red-900 font-medium">{{ error.message }}</p>
          <p v-if="error.details" class="text-red-700 text-sm mt-1">
            {{ error.details }}
          </p>
        </div>

        <!-- Initial State (no filters applied yet) -->
        <div v-else-if="!hasAppliedFilters" class="audit-panel text-center py-8">
          <p class="text-gray-600">Select a domain and apply filters to view decisions.</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!decisions || decisions.length === 0" class="audit-panel text-center py-8">
          <p class="text-gray-600">No decisions found for this organization and domain.</p>
        </div>

        <!-- Decision Table -->
        <div v-else>
          <DecisionTable
            :decisions="decisions"
            @select-decision="navigateToDecision"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DecisionListItem } from '~/types/mandate'

definePageMeta({
  layout: 'default'
})

const decisions = ref<DecisionListItem[]>([])
const loading = ref(false)
const error = ref<{ message: string; details?: string } | null>(null)
const hasAppliedFilters = ref(false)

const { fetchDecisions } = useMandateApi()
const { loadFilters, saveFilters } = useFilterStore()

const applyFilters = async (filters: any) => {
   if (!filters.organizationId || !filters.domain) {
     return
   }

   hasAppliedFilters.value = true

   const params: any = {
     organizationId: filters.organizationId,
     domain_name: filters.domain
   }
   if (filters.startTime && filters.endTime) {
     params.timeRange = {
       start: filters.startTime,
       end: filters.endTime
     }
   }
   if (filters.verdict) params.verdict = filters.verdict
   if (filters.intent) params.intent = filters.intent
   if (filters.agent) params.agent = filters.agent

   // Save filters to cache before fetching
   saveFilters(filters)

   const result = await fetchDecisions(params)
   loading.value = result.loading
   error.value = result.error
   decisions.value = result.data || []
}

const navigateToDecision = (decision: DecisionListItem) => {
   navigateTo({
     path: `/decisions/${decision.id}`,
     query: { organization_id: decision.organization_id, domain_name: decision.domain_name }
   })
 }

// Restore filters on mount
onMounted(() => {
  const cachedFilters = loadFilters()
  if (cachedFilters) {
    applyFilters(cachedFilters)
  }
})
</script>
