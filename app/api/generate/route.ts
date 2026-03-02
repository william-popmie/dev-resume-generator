import { NextRequest } from 'next/server'
import * as fs from 'fs/promises'
import { ResumeDataSchema, generateBulletPoints } from '@/lib/extractor'
import { renderAndCompile } from '@/lib/renderer'
import { z } from 'zod'

const RequestBodySchema = z.object({
  resumeData: ResumeDataSchema,
  descriptions: z.array(z.string()),
})

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | undefined

  try {
    // 1. Parse JSON body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    // 2. Validate body shape
    let resumeData: z.infer<typeof ResumeDataSchema>
    let descriptions: string[]
    try {
      const parsed = RequestBodySchema.parse(body)
      resumeData = parsed.resumeData
      descriptions = parsed.descriptions
    } catch {
      return new Response('Invalid request body', { status: 400 })
    }

    // 3. Generate bullet points for all roles
    const bullets = await generateBulletPoints(resumeData.work_experience, descriptions)

    // 4. Merge bullets into resumeData
    const enriched = {
      ...resumeData,
      work_experience: resumeData.work_experience.map((job, i) => ({
        ...job,
        bullets: bullets[i] ?? [],
      })),
    }

    // 5. Compile LaTeX to PDF
    const result = await renderAndCompile(enriched)
    cleanup = result.cleanup

    // 6. Read compiled PDF
    const pdfBytes = await fs.readFile(result.pdfPath)

    // 7. Clean up temp files
    await cleanup()
    cleanup = undefined

    // 8. Build a safe filename
    const safeName =
      resumeData.full_name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'Resume'

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}_Resume.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    })
  } catch (err: unknown) {
    if (cleanup) {
      await cleanup().catch(() => {})
    }

    console.error('[/api/generate] Error:', err)

    const message = err instanceof Error ? err.message : 'Internal server error'

    if (
      message.includes('pdflatex') ||
      message.includes('template.tex') ||
      message.includes('Gemini')
    ) {
      return new Response(message, { status: 500 })
    }

    if (message.includes('Invalid JSON') || message.includes('ZodError')) {
      return new Response(
        'Failed to generate resume. Please try again.',
        { status: 422 },
      )
    }

    return new Response(message, { status: 500 })
  }
}
