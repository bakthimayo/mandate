<template>
  <div class="audit-panel">
    <div class="space-y-4">
      <!-- Verdict Badge -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">VERDICT</p>
        <VerdictBadge :verdict="verdict.verdict" />
      </div>

      <!-- Decision & Spec ID -->
      <div>
        <p class="text-xs text-gray-600 font-medium mb-1">DECISION ID</p>
        <p class="audit-text-mono text-xs">{{ verdict.decision_id }}</p>
      </div>

      <!-- Spec ID + Version -->
      <div class="border-t pt-4 space-y-3">
        <h3 class="text-xs font-semibold text-gray-700 uppercase">
          Resolved Specification
        </h3>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p class="text-gray-600 font-medium mb-1">SPEC ID</p>
            <p class="audit-text-mono text-gray-700">{{ verdict.spec_id }}</p>
          </div>
          <div>
            <p class="text-gray-600 font-medium mb-1">SPEC VERSION</p>
            <p class="text-gray-700">v{{ verdict.spec_version }}</p>
          </div>
        </div>
      </div>

      <!-- Scope Context -->
      <div class="border-t pt-4 space-y-3">
        <h3 class="text-xs font-semibold text-gray-700 uppercase">
          Scope & Domain
        </h3>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p class="text-gray-600 font-medium mb-1">DOMAIN</p>
            <p class="text-gray-700 font-mono">{{ verdict.domain_name }}</p>
          </div>
          <div>
            <p class="text-gray-600 font-medium mb-1">SCOPE ID</p>
            <p class="audit-text-mono text-gray-700">{{ verdict.scope_id }}</p>
          </div>
        </div>

        <div
          v-if="verdict.matched_scope"
          class="bg-blue-50 border border-blue-100 rounded p-3 space-y-2"
        >
          <p v-if="verdict.matched_scope.service" class="text-xs text-gray-700">
            <span class="font-medium">Service:</span>
            {{ verdict.matched_scope.service }}
          </p>
          <p v-if="verdict.matched_scope.agent" class="text-xs text-gray-700">
            <span class="font-medium">Agent:</span>
            {{ verdict.matched_scope.agent }}
          </p>
          <p
            v-if="verdict.matched_scope.environment"
            class="text-xs text-gray-700"
          >
            <span class="font-medium">Environment:</span>
            {{ verdict.matched_scope.environment }}
          </p>
        </div>
      </div>

      <!-- Matched Policies -->
      <div
        v-if="verdict.matched_policies && verdict.matched_policies.length > 0"
        class="border-t pt-4 space-y-3"
      >
        <h3 class="text-xs font-semibold text-gray-700 uppercase">
          Matched Policies
        </h3>

        <div class="space-y-2">
          <div
            v-for="policy in verdict.matched_policies"
            :key="policy.id"
            class="bg-gray-50 border border-gray-200 rounded p-3 space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="audit-text-mono text-xs text-gray-700 font-medium">
                {{ policy.id }}
              </p>
              <span
                class="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-mono rounded"
              >
                {{ policy.verdict }}
              </span>
            </div>

            <!-- Policy Conditions -->
            <div
              v-if="policy.conditions && policy.conditions.length > 0"
              class="text-xs space-y-1 mt-2"
            >
              <p class="text-gray-600 font-medium">Conditions:</p>
              <div
                v-for="(cond, idx) in policy.conditions"
                :key="idx"
                class="text-gray-700 ml-2 p-1 bg-white rounded border border-gray-100"
              >
                <code class="text-xs"
                  >{{ cond.signal }} {{ cond.operator }}
                  {{ formatConditionValue(cond.value) }}</code
                >
              </div>
            </div>

            <!-- Policy Explanation -->
            <div
              v-if="policy.explanation"
              class="text-xs text-gray-700 italic mt-2"
            >
              {{ policy.explanation }}
            </div>
          </div>
        </div>
      </div>

      <!-- Matched Policy IDs (fallback) -->
      <div
        v-else-if="
          verdict.matched_policy_ids && verdict.matched_policy_ids.length > 0
        "
        class="border-t pt-4 space-y-3"
      >
        <h3 class="text-xs font-semibold text-gray-700 uppercase">
          Matched Policy IDs
        </h3>

        <div class="space-y-1">
          <div
            v-for="policyId in verdict.matched_policy_ids"
            :key="policyId"
            class="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded font-mono"
          >
            {{ policyId }}
          </div>
        </div>
      </div>

      <!-- Policy Snapshot -->
      <div class="border-t pt-4">
        <p class="text-xs text-gray-600 font-medium mb-1">POLICY SNAPSHOT ID</p>
        <p class="audit-text-mono text-xs text-gray-700">
          {{ verdict.policy_snapshot_id }}
        </p>
      </div>

      <!-- Explanation Text -->
      <div class="border-t pt-4">
        <p class="text-xs text-gray-600 font-medium mb-2">EXPLANATION</p>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
            {{ verdict.explanation }}
          </p>
          <p v-if="!verdict.explanation" class="text-sm text-gray-500 italic">
            No explanation provided
          </p>
        </div>
      </div>

      <!-- Authority & Source -->
      <div class="grid grid-cols-2 gap-3 text-xs border-t pt-4">
        <div>
          <p class="text-gray-600 font-medium mb-1">AUTHORITY SOURCE</p>
          <span
            class="inline-block px-2 py-1 rounded font-medium"
            :class="
              verdict.authority_source === 'human'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-blue-100 text-blue-800'
            "
          >
            {{
              verdict.authority_source === "human" ? "👤 Human" : "⚙️ System"
            }}
          </span>
        </div>
        <div>
          <p class="text-gray-600 font-medium mb-1">ISSUED AT</p>
          <p class="text-gray-700">{{ formatTimestamp(verdict.timestamp) }}</p>
        </div>
      </div>

      <!-- Precedence -->
      <div class="border-t pt-4">
        <p class="text-xs text-gray-600 font-medium mb-1">VERDICT PRECEDENCE</p>
        <div class="flex items-center gap-2">
          <span
            class="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded"
          >
            #{{ verdict.precedence_order }}
          </span>
          <span class="text-xs text-gray-500">
            ({{ getPrecedenceLabel(verdict.precedence_order) }})
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VerdictEvent } from "~/types/mandate";

interface Props {
  verdict: VerdictEvent;
}

defineProps<Props>();

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

const formatConditionValue = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getPrecedenceLabel = (order: number): string => {
  if (order === 1) return "highest priority";
  if (order <= 3) return "high priority";
  if (order <= 10) return "medium priority";
  return "lower priority";
};
</script>
