export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/styles.css'],
  app: {
    head: {
      title: 'Mandate Observability & Audit',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Read-only audit console for Mandate governance decisions'
        }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api/v1',
      organizationId: process.env.NUXT_PUBLIC_ORGANIZATION_ID || '550e8400-e29b-41d4-a716-446655440000'
    }
  }
})