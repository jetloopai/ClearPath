export interface ScopeItem {
  category: string
  issue: string
  estimatedCost: string
}

export interface ImageAnalysisResult {
  condition: 'cosmetic' | 'light' | 'medium' | 'heavy' | 'gut'
  confidence: 'low' | 'medium' | 'high'
  summary: string
  scopeOfWork: ScopeItem[]
}
