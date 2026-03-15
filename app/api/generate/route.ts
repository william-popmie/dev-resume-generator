import { NextRequest, NextResponse } from 'next/server'
import { ResumeDataSchema } from '@/lib/types'
import { generateBullets } from '@/lib/generator'
import { renderAndCompile } from '@/lib/renderer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resumeData = ResumeDataSchema.parse(body.resumeData)
    const descriptions: string[] = Array.isArray(body.descriptions) ? body.descriptions : []

    // Convert flat descriptions array to Record<"company|||title", notes>
    const userNotes: Record<string, string> = {}
    let fi = 0
    for (const company of resumeData.work_experience) {
      for (const pos of company.positions) {
        const key = `${company.company}|||${pos.title}`
        userNotes[key] = descriptions[fi] ?? ''
        fi++
      }
    }

    const template: string = typeof body.template === 'string' ? body.template : 'formal'
    const bullets = await generateBullets(resumeData, userNotes)
    const pdfBuffer = await renderAndCompile(resumeData, bullets, template)

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
