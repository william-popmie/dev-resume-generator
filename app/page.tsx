'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import type { ResumeData } from '@/lib/extractor'

type Step = 'upload' | 'describe' | 'download'

// Returns the flat position index across all companies.
// positions are ordered: company[0].positions[0], [1], ..., company[1].positions[0], ...
function flatIndex(resumeData: ResumeData, companyIdx: number, positionIdx: number): number {
  let idx = 0
  for (let c = 0; c < companyIdx; c++) {
    idx += resumeData.work_experience[c].positions.length
  }
  return idx + positionIdx
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload')

  // Step 1
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Step 2
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  // Flat array — one entry per position across all companies
  const [descriptions, setDescriptions] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  // Step 3
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState<string>('resume.pdf')

  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Step 1
  // -------------------------------------------------------------------------

  const setFileIfPdf = (f: File) => {
    if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
      setFile(f)
      setError(null)
    } else {
      setError('Please upload a PDF file.')
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFileIfPdf(dropped)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFileIfPdf(selected)
  }

  const handleExtract = async () => {
    if (!file) return
    setExtracting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract', { method: 'POST', body: formData })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Server error: ${response.status}`)
      }

      const data: ResumeData = await response.json()
      const totalPositions = data.work_experience.reduce((acc, c) => acc + c.positions.length, 0)
      setResumeData(data)
      setDescriptions(Array(totalPositions).fill(''))
      setStep('describe')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setExtracting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Step 2
  // -------------------------------------------------------------------------

  const setDescription = (flatIdx: number, value: string) => {
    setDescriptions((prev) => {
      const next = [...prev]
      next[flatIdx] = value
      return next
    })
  }

  const handleGenerate = async () => {
    if (!resumeData) return
    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData, descriptions }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      setDownloadName(match?.[1] ?? 'resume.pdf')
      setDownloadUrl(url)
      setStep('download')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setGenerating(false)
    }
  }

  const handleStartOver = () => {
    setStep('upload')
    setFile(null)
    setResumeData(null)
    setDescriptions([])
    setDownloadUrl(null)
    setError(null)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Resume Generator</h1>
          <p className="text-gray-500 text-lg">
            Upload your LinkedIn PDF export and get a polished LaTeX resume in seconds.
          </p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1 — Upload                                                     */}
        {/* ------------------------------------------------------------------ */}
        {step === 'upload' && (
          <>
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {file ? (
                <div>
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-700 font-semibold text-lg">{file.name}</p>
                  <p className="text-green-600 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-gray-400 text-xs mt-2">Click to change file</p>
                </div>
              ) : (
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-700 text-lg font-medium">Drop your LinkedIn PDF here</p>
                  <p className="text-gray-400 text-sm mt-1">or click to browse</p>
                  <p className="text-gray-300 text-xs mt-3">PDF up to 20 MB</p>
                </div>
              )}
            </div>

            <button
              onClick={handleExtract}
              disabled={!file || extracting}
              className="mt-6 w-full py-3.5 px-6 rounded-xl font-semibold text-white text-lg transition-all
                bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
            >
              {extracting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Extracting from LinkedIn…
                </span>
              ) : (
                'Extract from LinkedIn'
              )}
            </button>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2 — Describe roles                                             */}
        {/* ------------------------------------------------------------------ */}
        {step === 'describe' && resumeData && (
          <>
            <p className="text-gray-500 text-sm mb-6">
              Describe what you did in each role — Gemini will turn your notes into polished bullet
              points. Leave a field blank and it will infer from the job title. Anything Gemini
              already found on your LinkedIn profile is shown in grey.
            </p>

            <div className="space-y-5">
              {resumeData.work_experience.map((company, ci) => (
                <div
                  key={ci}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Company header */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="font-semibold text-gray-900">{company.company}</p>
                    {company.location && (
                      <p className="text-gray-400 text-xs mt-0.5">{company.location}</p>
                    )}
                  </div>

                  {/* Positions */}
                  <div className="divide-y divide-gray-100">
                    {company.positions.map((pos, pi) => {
                      const fi = flatIndex(resumeData, ci, pi)
                      return (
                        <div key={pi} className="px-5 py-4">
                          {/* Position meta */}
                          <div className="flex flex-wrap items-baseline gap-x-2 mb-2">
                            <span className="font-medium text-gray-800 text-sm">{pos.title}</span>
                            {pos.location && (
                              <span className="text-gray-400 text-xs">· {pos.location}</span>
                            )}
                            <span className="text-gray-400 text-xs ml-auto">
                              {pos.start_date} – {pos.end_date}
                            </span>
                          </div>

                          {/* LinkedIn description (context) */}
                          {pos.linkedin_description && (
                            <p className="text-xs text-gray-400 italic mb-2 leading-relaxed">
                              {pos.linkedin_description}
                            </p>
                          )}

                          {/* User description textarea */}
                          <textarea
                            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-800
                              placeholder-gray-400 resize-none focus:outline-none focus:ring-2
                              focus:ring-blue-400 focus:border-transparent transition"
                            rows={3}
                            placeholder="Describe your responsibilities and achievements…"
                            value={descriptions[fi]}
                            onChange={(e) => setDescription(fi, e.target.value)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setStep('upload'); setError(null) }}
                className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-gray-700 text-lg
                  border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-[2] py-3.5 px-6 rounded-xl font-semibold text-white text-lg transition-all
                  bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                  disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating Resume…
                  </span>
                ) : (
                  'Generate Resume'
                )}
              </button>
            </div>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3 — Download                                                   */}
        {/* ------------------------------------------------------------------ */}
        {step === 'download' && downloadUrl && (
          <>
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-800 font-semibold text-xl mb-1">Your resume is ready!</p>
              <p className="text-gray-400 text-sm">Bullet points generated from your descriptions.</p>
            </div>

            <a
              href={downloadUrl}
              download={downloadName}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl
                font-semibold text-white text-lg bg-green-600 hover:bg-green-700 active:bg-green-800
                transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {downloadName}
            </a>

            <button
              onClick={handleStartOver}
              className="mt-3 w-full py-3 px-6 rounded-xl font-semibold text-gray-600 text-base
                border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Start over
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-gray-300 text-xs">
          Your PDF is processed by Gemini and immediately deleted. Nothing is stored.
        </p>
      </div>
    </main>
  )
}
