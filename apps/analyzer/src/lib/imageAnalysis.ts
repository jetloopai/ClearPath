export interface ScopeItem {
  category: string
  issue: string
  estimatedCost: string
  /** Index into the submitted images array where this issue is visible. */
  imageIndex: number
  /** Approximate position of the issue on that image, as a percentage (0-100) of image width/height. */
  region: { x: number; y: number }
}

export interface ImageAnalysisResult {
  condition: 'cosmetic' | 'light' | 'medium' | 'heavy' | 'gut'
  confidence: 'low' | 'medium' | 'high'
  summary: string
  scopeOfWork: ScopeItem[]
}
