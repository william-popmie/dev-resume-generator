import { NextRequest, NextResponse } from 'next/server'
import { extractResumeData } from '@/lib/extractor'

const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const resumeData = await extractResumeData(buffer, file.name)

    return NextResponse.json(resumeData)
  } catch (err: unknown) {
    console.error('[/api/extract] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'

    if (message.includes('Gemini')) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    if (message.includes('Invalid JSON') || message.includes('ZodError')) {
      return NextResponse.json(
        { error: 'Failed to parse resume data from PDF. Please try a different export.' },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
