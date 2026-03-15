'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import type { ResumeData } from '@/lib/extractor'

type Step = 'upload' | 'describe' | 'download'

type SelectionState = {
  work_experience: boolean[][] // [companyIdx][positionIdx]
  education: boolean[]
  skills: boolean[]
}

// Returns the flat position index across all companies.
// positions are ordered: company[0].positions[0], [1], ..., company[1].positions[0], ...
function flatIndex(resumeData: ResumeData, companyIdx: number, positionIdx: number): number {
  let idx = 0
  for (let c = 0; c < companyIdx; c++) {
    idx += resumeData.work_experience[c].positions.length
  }
  return idx + positionIdx
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload')

  // Template selection
  const [template, setTemplate] = useState<'formal' | 'modern'>('formal')

  // Step 1
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Step 2
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  // Flat array — one entry per position across all companies
  const [descriptions, setDescriptions] = useState<string[]>([])
  const [selection, setSelection] = useState<SelectionState | null>(null)
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
      setSelection({
        work_experience: data.work_experience.map(c => c.positions.map(() => true)),
        education: data.education.map(() => true),
        skills: data.skills.map(() => true),
      })
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

  const togglePosition = (ci: number, pi: number) => {
    setSelection(prev => {
      if (!prev) return prev
      const we = prev.work_experience.map(row => [...row])
      we[ci][pi] = !we[ci][pi]
      return { ...prev, work_experience: we }
    })
  }

  const toggleFlat = (section: 'education' | 'skills', i: number) => {
    setSelection(prev => {
      if (!prev) return prev
      const arr = [...prev[section]]
      arr[i] = !arr[i]
      return { ...prev, [section]: arr }
    })
  }

  const handleGenerate = async () => {
    if (!resumeData || !selection) return
    setGenerating(true)
    setError(null)

    try {
      const sel = selection

      const filteredExperience = resumeData.work_experience
        .map((c, ci) => ({ ...c, positions: c.positions.filter((_, pi) => sel.work_experience[ci]?.[pi] ?? true) }))
        .filter(c => c.positions.length > 0)

      const filteredResumeData: ResumeData = {
        ...resumeData,
        work_experience: filteredExperience,
        education: resumeData.education.filter((_, i) => sel.education[i] ?? true),
        skills: resumeData.skills.filter((_, i) => sel.skills[i] ?? true),
      }

      const filteredDescriptions: string[] = []
      resumeData.work_experience.forEach((company, ci) =>
        company.positions.forEach((_, pi) => {
          if (sel.work_experience[ci]?.[pi] ?? true)
            filteredDescriptions.push(descriptions[flatIndex(resumeData, ci, pi)])
        })
      )

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: filteredResumeData, descriptions: filteredDescriptions, template }),
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
    setSelection(null)
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
            {/* Template picker */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Choose a template</p>
              <div className="grid grid-cols-2 gap-3">
                {(['formal', 'modern'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={`rounded-xl border-2 px-5 py-4 text-left transition-all ${
                      template === t
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-gray-900 capitalize">{t}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t === 'formal' ? 'Serif · Classic' : 'Sans-serif · Modern'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

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
        {step === 'describe' && resumeData && selection && (
          <>
            <p className="text-gray-500 text-sm mb-6">
              Describe what you did in each role — Claude will turn your notes into polished bullet
              points. Leave a field blank and it will infer from the job title. Anything Claude
              already found on your LinkedIn profile is shown in grey. Uncheck any item to exclude it
              from the resume.
            </p>

            {/* Work Experience */}
            <SectionBlock title="Work Experience">
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
                      const enabled = selection.work_experience[ci]?.[pi] ?? true
                      return (
                        <div key={pi} className={`transition-opacity ${!enabled ? 'opacity-50' : ''}`}>
                          {/* Position header bar */}
                          <div className="relative px-5 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="flex flex-wrap items-baseline gap-x-2 pr-8">
                              <span className="font-medium text-gray-800 text-sm">{pos.title}</span>
                              {pos.location && (
                                <span className="text-gray-400 text-xs">· {pos.location}</span>
                              )}
                              <span className="text-gray-400 text-xs ml-auto">
                                {pos.start_date} – {pos.end_date}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              className="absolute top-3 right-4 h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0"
                              checked={enabled}
                              onChange={() => togglePosition(ci, pi)}
                            />
                          </div>

                          {/* Position body */}
                          <div className="px-5 py-4">
                            {/* LinkedIn description (context) */}
                            {enabled && pos.linkedin_description && (
                              <p className="text-xs text-gray-400 italic mb-2 leading-relaxed">
                                {pos.linkedin_description}
                              </p>
                            )}

                            {/* User description textarea */}
                            {enabled && (
                              <textarea
                                className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-800
                                  placeholder-gray-400 resize-none focus:outline-none focus:ring-2
                                  focus:ring-blue-400 focus:border-transparent transition"
                                rows={3}
                                placeholder="Describe your responsibilities and achievements…"
                                value={descriptions[fi]}
                                onChange={(e) => setDescription(fi, e.target.value)}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </SectionBlock>

            {/* Education */}
            {resumeData.education.length > 0 && (
              <SectionBlock title="Education">
                {resumeData.education.map((edu, i) => {
                  const enabled = selection.education[i] ?? true
                  return (
                    <div
                      key={i}
                      className={`bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 flex items-start justify-between gap-4 transition-opacity ${!enabled ? 'opacity-40' : ''}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{edu.school}</p>
                        <p className="text-sm text-gray-500">{edu.degree}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {edu.start_date} – {edu.end_date}{edu.location ? ` · ${edu.location}` : ''}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-0.5 accent-blue-600 cursor-pointer flex-shrink-0"
                        checked={enabled}
                        onChange={() => toggleFlat('education', i)}
                      />
                    </div>
                  )
                })}
              </SectionBlock>
            )}

            {/* Skills */}
            {resumeData.skills.length > 0 && (
              <SectionBlock title="Skills">
                {resumeData.skills.map((cat, i) => {
                  const enabled = selection.skills[i] ?? true
                  return (
                    <div
                      key={i}
                      className={`bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 flex items-start justify-between gap-4 transition-opacity ${!enabled ? 'opacity-40' : ''}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{cat.category}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{cat.skills}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-0.5 accent-blue-600 cursor-pointer flex-shrink-0"
                        checked={enabled}
                        onChange={() => toggleFlat('skills', i)}
                      />
                    </div>
                  )
                })}
              </SectionBlock>
            )}

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
          Your PDF is processed by Claude and never stored.
        </p>
      </div>
    </main>
  )
}
