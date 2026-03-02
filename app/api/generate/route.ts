import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import { extractResumeData } from '@/lib/extractor'
import { renderAndCompile } from '@/lib/renderer'

const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | undefined

  try {
    // 1. Parse multipart form data
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

    // 2. Validate file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // 3. Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // 4. Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // 5. Extract structured data from PDF via Gemini
    const resumeData = await extractResumeData(buffer, file.name)

    // 6. Generate LaTeX and compile to PDF
    const result = await renderAndCompile(resumeData)
    cleanup = result.cleanup

    // 7. Read compiled PDF
    const pdfBytes = await fs.readFile(result.pdfPath)

    // 8. Clean up temp files
    await cleanup()
    cleanup = undefined

    // 9. Build a safe filename
    const safeName = resumeData.full_name
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
    // Ensure cleanup happens even on error
    if (cleanup) {
      await cleanup().catch(() => {})
    }

    console.error('[/api/generate] Error:', err)

    const message = err instanceof Error ? err.message : 'Internal server error'

    // Distinguish user-facing errors from internal ones
    if (
      message.includes('pdflatex') ||
      message.includes('template.tex') ||
      message.includes('Gemini')
    ) {
      return new Response(message, { status: 500 })
    }

    if (message.includes('Invalid JSON') || message.includes('ZodError')) {
      return new Response(
        'Failed to parse resume data from PDF. Please try a different export.',
        { status: 422 },
      )
    }

    return new Response(message, { status: 500 })
  }
}
