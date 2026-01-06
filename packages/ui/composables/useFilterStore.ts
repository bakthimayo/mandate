/**
 * Filter cache store using sessionStorage
 * Preserves decision list filters when navigating to detail/timeline pages
 * Clears on page refresh or session end
 */

export interface DecisionFilters {
  organizationId: string
  domain: string
  startTime?: string
  endTime?: string
  verdict?: string
  intent?: string
  agent?: string
}

const FILTER_STORAGE_KEY = 'mandate:decision-filters'

export const useFilterStore = () => {
  const loadFilters = (): DecisionFilters | null => {
    if (process.server) return null
    
    try {
      const stored = sessionStorage.getItem(FILTER_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const saveFilters = (filters: DecisionFilters) => {
    if (process.server) return
    
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Silently fail if storage is unavailable
    }
  }

  const clearFilters = () => {
    if (process.server) return
    
    try {
      sessionStorage.removeItem(FILTER_STORAGE_KEY)
    } catch {
      // Silently fail if storage is unavailable
    }
  }

  const getCachedFilters = (): DecisionFilters | null => {
    return loadFilters()
  }

  return {
    loadFilters,
    saveFilters,
    clearFilters,
    getCachedFilters,
  }
}
