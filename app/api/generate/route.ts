import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ResumeDataSchema, GitHubProjectSchema } from '@/lib/types'
import { generateBullets, generateProjectBullets } from '@/lib/generator'
import { renderAndCompile } from '@/lib/renderer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resumeData = ResumeDataSchema.parse(body.resumeData)
    const descriptions: string[] = Array.isArray(body.descriptions) ? body.descriptions : []
    const projects = z.array(GitHubProjectSchema).optional().default([]).parse(body.projects)

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

    const bullets = await generateBullets(resumeData, userNotes)

    let projectBullets: Record<string, string[]> | undefined
    if (projects.length > 0) {
      projectBullets = await generateProjectBullets(projects)
    }

    const pdfBuffer = await renderAndCompile(resumeData, bullets, projects.length > 0 ? projects : undefined, projectBullets)

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
