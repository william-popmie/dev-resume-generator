import { NextRequest, NextResponse } from 'next/server'
import { ResumeDataSchema } from '@/lib/types'
import { generateBullets } from '@/lib/generator'
import { renderAndCompile } from '@/lib/renderer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resumeData = ResumeDataSchema.parse(body.resumeData)
    const descriptions: string[] = Array.isArray(body.descriptions) ? body.descriptions : []

    const bullets = await generateBullets(resumeData, descriptions)
    const pdfBuffer = await renderAndCompile(resumeData, bullets)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
      },
    })
  } catch (err: unknown) {
    console.error('[/api/generate] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
