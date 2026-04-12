export type ProviderName = 'rentcast' | 'attom' | 'manual' | 'formula' | 'legacy' | 'stub'

export interface ProviderSelectionPolicy {
  subjectFacts: ProviderName
  value: ProviderName
  rent: ProviderName
  comps: ProviderName
}

export const providerPolicies: ProviderSelectionPolicy = {
  subjectFacts: 'rentcast',
  value: 'rentcast',
  rent: 'rentcast',
  comps: 'rentcast',
}

export function getProviderLabel(provider: ProviderName | string | null | undefined): string {
  switch (provider) {
    case 'rentcast':
      return 'RentCast'
    case 'attom':
      return 'ATTOM'
    case 'manual':
      return 'Manual override'
    case 'formula':
      return 'Formula fallback'
    case 'legacy':
      return 'Legacy fallback'
    case 'stub':
      return 'Fallback stub'
    default:
      return 'Unknown provider'
  }
}

export function getRentCastApiKey(): string | null {
  return process.env.RENTCAST_API_KEY?.trim() || null
}

export function getRapidApiZillowKey(): string | null {
  return process.env.RAPIDAPI_ZILLOW_KEY?.trim() || null
}

export function isProviderEnabled(provider: ProviderName): boolean {
  switch (provider) {
    case 'rentcast':
      return Boolean(getRentCastApiKey())
    case 'legacy':
      return Boolean(getRapidApiZillowKey())
    default:
      return false
  }
}
