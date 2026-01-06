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
      <span class="text-gray-400">|</span>
      <NuxtLink
        :to="{
          path: `/decisions/${decisionId}`,
          query: { 
            organization_id: route.query.organization_id,
            domain: route.query.domain
          }
        }"
        class="text-blue-600 hover:underline text-sm font-medium"
      >
        Decision Details
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="audit-panel text-center py-8">
      <p class="text-gray-600">Loading timeline...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="audit-panel bg-red-50 border-red-200">
      <p class="text-red-900 font-medium">{{ error.message }}</p>
    </div>

    <!-- Timeline -->
    <div v-else-if="timeline">
      <!-- Page Title -->
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Decision Timeline</h1>
        <p class="text-gray-600 mt-1">
          Chronological record of all events for decision
          {{ decisionId.slice(0, 12) }}...
        </p>
      </div>

      <!-- Decision Context -->
      <div class="audit-panel">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-gray-600 font-medium mb-1">DECISION ID</p>
            <p class="audit-text-mono text-sm">
              {{ decisionId }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-600 font-medium mb-1">INTENT</p>
            <p class="text-sm text-gray-900">
              {{ timeline.decision_event.intent }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-600 font-medium mb-1">STAGE</p>
            <p class="text-sm text-gray-900">
              {{ timeline.decision_event.stage }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-600 font-medium mb-1">INITIATED</p>
            <p class="text-sm text-gray-500">
              {{ formatTimestamp(timeline.decision_event.timestamp) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Vertical Timeline -->
      <div class="space-y-0">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Event History</h2>

        <!-- Events: Chronological, no collapsing -->
        <div
          v-for="(entry, index) in timeline.timeline"
          :key="entry.id || entry.entry_id"
          class="relative"
        >
          <!-- Timeline Line (not on last item) -->
          <div
            v-if="index < timeline.timeline.length - 1"
            class="absolute left-6 top-12 w-0.5 h-12 bg-gray-200"
          />

          <!-- Timeline Entry Card -->
          <div class="relative pl-16 pb-8">
            <!-- Timeline Dot -->
            <div
              class="absolute left-0 top-2 w-12 h-12 flex items-center justify-center bg-white border-4 rounded-full"
              :class="getDotColor(entry.type)"
            >
              <span :class="getEntryIcon(entry.type)">
                {{ getIconEmoji(entry.type) }}
              </span>
            </div>

            <!-- Entry Card -->
            <div class="audit-panel space-y-3">
              <!-- Header: Type + Source + Authority -->
              <div class="flex items-start justify-between">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-gray-900">
                      {{ entry.summary }}
                    </h3>
                    <span
                      class="inline-block px-2 py-1 text-xs font-medium rounded"
                      :class="getTypeColor(entry.type)"
                    >
                      {{ entry.type.toUpperCase() }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500">
                    {{ formatTimestamp(entry.timestamp) }}
                  </p>
                </div>
              </div>

              <!-- Metadata Row -->
              <div
                class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t pt-3"
              >
                <div>
                  <p class="text-gray-600 font-medium">Source</p>
                  <p class="text-gray-900 mt-0.5">
                    {{ formatSource(entry.source) }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-600 font-medium">Authority</p>
                  <p class="text-gray-900 mt-0.5">
                    {{ entry.authority_level || "—" }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-600 font-medium">Timestamp</p>
                  <p class="text-gray-500 font-mono mt-0.5">
                    {{ formatTimestampISO(entry.timestamp) }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-600 font-medium">Type</p>
                  <p class="text-gray-900 mt-0.5">
                    {{ entry.type }}
                  </p>
                </div>
              </div>

              <!-- Expandable JSON Details -->
              <div
                v-if="expandedEntries.includes(entry.id || entry.entry_id)"
                class="border-t pt-3 space-y-2"
              >
                <div>
                  <p class="text-xs font-medium text-gray-700 mb-2">
                    Full Event Details (JSON)
                  </p>
                  <JsonViewer :data="entry.details" />
                </div>
              </div>

              <!-- Expand/Collapse Button -->
              <button
                @click="toggleExpanded(entry.id || entry.entry_id)"
                class="text-xs font-medium text-blue-600 hover:underline"
              >
                {{ expandedEntries.includes(entry.id || entry.entry_id) ? "Collapse" : "Expand" }}
                Details
              </button>
            </div>
          </div>
        </div>

        <!-- Empty Timeline -->
        <div
          v-if="!timeline.timeline || timeline.timeline.length === 0"
          class="audit-panel text-center py-8"
        >
          <p class="text-gray-600">No events recorded for this decision.</p>
        </div>
      </div>
     
      <!-- Verdict (if available) -->
      <div v-if="timeline.verdict" class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Final Verdict</h2>
        <div class="audit-panel space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 font-medium">VERDICT</p>
              <div class="mt-2">
                <VerdictBadge :verdict="timeline.verdict.verdict" />
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-600 font-medium">ISSUED AT</p>
              <p class="text-sm text-gray-900 mt-1">
                {{ formatTimestamp(timeline.verdict.timestamp) }}
              </p>
            </div>
          </div>

          <div class="border-t pt-4 space-y-3">
            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">EXPLANATION</p>
              <p class="text-sm text-gray-900">
                {{ timeline.verdict.explanation }}
              </p>
            </div>

            <div v-if="timeline.verdict.matched_scopes?.length > 0">
              <p class="text-xs text-gray-600 font-medium mb-2">
                MATCHED SCOPES
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="scope in timeline.verdict.matched_scopes"
                  :key="scope"
                  class="inline-block px-2 py-1 bg-blue-50 text-blue-900 text-xs rounded"
                >
                  {{ scope }}
                </span>
              </div>
            </div>

            <div v-if="timeline.verdict.matched_policies?.length > 0">
              <p class="text-xs text-gray-600 font-medium mb-2">
                MATCHED POLICIES
              </p>
              <div class="space-y-1">
                <div
                  v-for="policy in timeline.verdict.matched_policies"
                  :key="policy"
                  class="text-xs text-gray-700 font-mono"
                >
                  {{ policy }}
                </div>
              </div>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">
                POLICY SNAPSHOT ID
              </p>
              <p class="text-xs text-gray-900 font-mono">
                {{ timeline.verdict.policy_snapshot_id }}
              </p>
            </div>

            <div>
              <p class="text-xs text-gray-600 font-medium mb-1">
                PRECEDENCE ORDER
              </p>
              <p class="text-sm text-gray-900">
                {{ timeline.verdict.precedence_order }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-8 audit-panel">
        <p class="text-sm font-semibold text-gray-900 mb-3">Legend</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full bg-white border-4 border-blue-200 flex items-center justify-center"
            >
              📋
            </div>
            <span class="text-gray-700">Decision Event</span>
          </div>
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full bg-white border-4 border-green-200 flex items-center justify-center"
            >
              ✓
            </div>
            <span class="text-gray-700">Verdict Event</span>
          </div>
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full bg-white border-4 border-amber-200 flex items-center justify-center"
            >
              📝
            </div>
            <span class="text-gray-700">Audit Entry</span>
          </div>
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
  ssr: false,
});

const route = useRoute();
const { fetchDecisionTimeline } = useMandateApi();

const timeline = ref<DecisionTimeline | null>(null);
const loading = ref(true);
const error = ref<{ message: string } | null>(null);
const expandedEntries = ref<string[]>([]);

const decisionId = computed(() => route.params.decisionId as string);
const organizationId = computed(
  () => (route.query.organization_id as string) || ""
);
const domain = computed(() => (route.query.domain as string) || "");

const loadTimeline = async () => {
  if (!decisionId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const result = await fetchDecisionTimeline(
      decisionId.value,
      organizationId.value || undefined,
      domain.value || undefined
    );

    if (result.error) {
      error.value = result.error;
      timeline.value = null;
    } else {
      timeline.value = result.data;
    }
  } finally {
    loading.value = false;
  }
};

const toggleExpanded = (entryId: string) => {
  const idx = expandedEntries.value.indexOf(entryId);
  if (idx > -1) {
    expandedEntries.value.splice(idx, 1);
  } else {
    expandedEntries.value.push(entryId);
  }
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

const formatTimestampISO = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toISOString();
  } catch {
    return timestamp;
  }
};

const formatSource = (source: string): string => {
  const sources: Record<string, string> = {
    control_plane: "Control Plane",
    agent: "Agent",
    human: "Human",
  };
  return sources[source] || source;
};

const getDotColor = (type: string): string => {
  const colors: Record<string, string> = {
    decision: "border-blue-200",
    verdict: "border-green-200",
    audit: "border-amber-200",
  };
  return colors[type] || "border-gray-200";
};

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    decision: "bg-blue-100 text-blue-800",
    verdict: "bg-green-100 text-green-800",
    audit: "bg-amber-100 text-amber-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

const getEntryIcon = (type: string): string => {
  return "text-lg";
};

const getIconEmoji = (type: string): string => {
  const icons: Record<string, string> = {
    decision: "📋",
    verdict: "✓",
    audit: "📝",
  };
  return icons[type] || "•";
};

onMounted(() => {
  loadTimeline();
});

watch(decisionId, () => {
  loadTimeline();
});
</script>

<style scoped>
.timeline-entry {
  @apply relative;
}

.audit-text-mono {
  @apply font-mono;
}
</style>
