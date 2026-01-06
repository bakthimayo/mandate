<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Mandate</h1>
            <p class="text-sm text-gray-600">Observability & Audit</p>
          </div>
          <div class="text-sm text-gray-500">
            Read-Only Console
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p class="text-sm text-gray-600">
          Mandate AI Control Plane &mdash; RFC-003: Observability & Audit UI (Read-Only)
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// No state mutations - this is a read-only application
</script>
