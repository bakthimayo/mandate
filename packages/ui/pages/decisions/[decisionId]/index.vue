<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/"
        class="text-blue-600 hover:underline text-sm font-medium"
      >
        ← Back to Decisions
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="audit-panel text-center py-8">
      <p class="text-gray-600">Loading decision details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="audit-panel bg-red-50 border-red-200">
      <p class="text-red-900 font-medium">{{ error.message }}</p>
    </div>

    <!-- Decision Timeline -->
    <div v-else-if="timeline">
      <!-- Decision Summary -->
      <div class="audit-panel mb-6">
        <div class="grid grid-cols-12 gap-4">
           <div class="col-span-2">
             <p class="text-xs text-gray-600 font-medium mb-1">INTENT</p>
             <p class="text-sm text-gray-900">
               {{ timeline.decision_event?.intent || '—' }}
             </p>
           </div>
           <div class="col-span-2">
             <p class="text-xs text-gray-600 font-medium mb-1">STAGE</p>
             <p class="text-sm text-gray-900">
               {{ timeline.decision_event?.stage || '—' }}
             </p>
           </div>
           <div class="col-span-3">
             <p class="text-xs text-gray-600 font-medium mb-1">SPEC ID</p>
             <p class="audit-text-mono text-xs">
               {{ timeline.verdict?.spec_id || '—' }}
             </p>
           </div>
          <div v-if="timeline.verdict" class="col-span-2">
            <p class="text-xs text-gray-600 font-medium mb-1">VERDICT</p>
            <VerdictBadge :verdict="timeline.verdict.verdict" />
          </div>
          <div v-if="timeline.verdict?.scope_id" class="col-span-3">
            <p class="text-xs text-gray-600 font-medium mb-1">SCOPE ID</p>
            <p class="audit-text-mono text-xs">
              {{ timeline.verdict.scope_id }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Timeline -->
        <div class="lg:col-span-1 space-y-2">
          <h2 class="text-lg font-semibold text-gray-900">Timeline</h2>
          <div v-for="entry in timeline.timeline" :key="entry.id">
            <TimelineEntry :entry="entry" />
          </div>
        </div>

        <!-- Verdict Explanation -->
        <div v-if="timeline.verdict" class="lg:col-span-1 space-y-2">
          <h2 class="text-lg font-semibold text-gray-900">Verdict Explanation</h2>
          <VerdictExplanation :verdict="timeline.verdict" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="audit-panel text-center py-8">
      <p class="text-gray-600">Decision not found.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DecisionTimeline } from "~/types/mandate";

definePageMeta({
  layout: "default",
});

const route = useRoute();
const { fetchDecisionTimeline } = useMandateApi();

const timeline = ref<DecisionTimeline | null>(null);
const loading = ref(false);
const error = ref<{ message: string } | null>(null);
const loadedDecisionId = ref<string>("");
let isLoading = false;

const decisionId = computed(() => route.params.decisionId as string);
const organizationId = computed(
  () => (route.query.organization_id as string) || ""
);
const domain_name = computed(() => (route.query.domain_name as string) || "");

const loadTimeline = async () => {
   if (
     !decisionId.value ||
     isLoading ||
     loadedDecisionId.value === decisionId.value
   ) {
     return;
   }

   isLoading = true;
   loading.value = true;
   error.value = null;
   timeline.value = null;

   const result = await fetchDecisionTimeline(
     decisionId.value,
     organizationId.value || undefined,
     domain_name.value || undefined
   );

  if (result.error) {
    error.value = result.error;
  } else {
    timeline.value = result.data;
  }

  loadedDecisionId.value = decisionId.value;
  await nextTick();
  loading.value = false;
  isLoading = false;
};

onMounted(() => {
  loadTimeline();
});

watch(
  [decisionId, organizationId, domain_name],
  ([newId, newOrgId, newDomainName], [oldId]) => {
    if (newId && newId !== oldId && newId !== loadedDecisionId.value) {
      loadTimeline();
    }
  },
  { immediate: false }
);
</script>
