import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIp } from '@/lib/rateLimit'
import Anthropic from '@anthropic-ai/sdk'
import type { ImageAnalysisResult } from '@/lib/imageAnalysis'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a real estate rehab expert assessing property condition from photos.
Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

Images are provided in order and labeled "Image 0", "Image 1", etc. in the accompanying text.

Condition tiers:
- cosmetic: Paint, flooring, fixtures. Move-in ready bones.
- light: Cosmetic + kitchen/bath refresh, minor repairs.
- medium: Full kitchen/bath remodel, HVAC service, some electrical/plumbing updates.
- heavy: Structural repairs, full systems replacement (roof, HVAC, plumbing, electrical).
- gut: Complete gut renovation, potential foundation/structural issues.

Return this exact shape:
{
  "condition": "cosmetic" | "light" | "medium" | "heavy" | "gut",
  "confidence": "low" | "medium" | "high",
  "summary": "2-3 sentences describing the overall property condition and key findings",
  "scopeOfWork": [
    {
      "category": "Kitchen",
      "issue": "Specific issue observed",
      "estimatedCost": "$X,000–$X,000",
      "imageIndex": 0,
      "region": { "x": 50, "y": 30 }
    }
  ]
}

confidence is "high" if interior photos clearly show condition, "medium" if only exterior or partial views, "low" if photos are unclear or very limited.
Only include scopeOfWork items for issues actually visible in the photos. Omit categories that look fine.

For each scopeOfWork item, "imageIndex" is the 0-based index of the image (from the labels "Image 0", "Image 1", ...) where that issue is visible, and "region" is your best estimate of where the issue is centered in that image, as a percentage of image width ("x") and height ("y"), each 0-100 (0,0 is top-left). Give your best visual estimate even if approximate — do not omit these fields.`

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 10 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const { images } = await req.json()

  if (!images || !Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
  }

  if (images.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 images allowed' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Image analysis not configured' }, { status: 503 })
  }

  try {
    // Build labeled image content blocks — a text label before each image so the model
    // can reliably reference "imageIndex" in its response, interleaved with the image itself.
    const labeledContent: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] = images.flatMap(
      (dataUrl: string, i: number) => {
        const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/)
        if (!match) throw new Error('Invalid image format')
        const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        return [
          { type: 'text' as const, text: `Image ${i}:` },
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: match[2] } },
        ]
      }
    )

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...labeledContent,
            { type: 'text', text: `Assess these ${images.length} property photo(s) and return the JSON.` },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    let result: ImageAnalysisResult
    try {
      // Strip any accidental markdown fences
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      console.error('Claude returned non-JSON:', text)
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Image analysis error:', err)
    return NextResponse.json({ error: err.message ?? 'Analysis failed' }, { status: 500 })
  }
}
