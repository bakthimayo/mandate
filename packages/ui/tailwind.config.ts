import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      colors: {
        verdict: {
          allow: '#10b981',
          pause: '#f59e0b',
          block: '#ef4444',
          observe: '#6b7280'
        }
      }
    }
  },
  plugins: []
} satisfies Config
