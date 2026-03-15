'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import type { ResumeData, Company, Position, Education, SkillCategory } from '@/lib/types'

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

function blankResumeData(): ResumeData {
  return { name: '', phone: '', email: '', linkedin_url: '', location: '',
           work_experience: [], education: [], skills: [] }
}

function insertDescriptionAt(d: string[], fi: number): string[] {
  const n = [...d]; n.splice(fi, 0, ''); return n
}

function deleteDescriptionAt(d: string[], fi: number): string[] {
  const n = [...d]; n.splice(fi, 1); return n
}

function descriptionRangeForCompany(rd: ResumeData, ci: number): [number, number] {
  const start = flatIndex(rd, ci, 0)
  return [start, start + rd.work_experience[ci].positions.length]
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

const inputCls = "w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
const dashedBtnCls = "mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"

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

  const handleStartFromScratch = () => {
    setResumeData(blankResumeData())
    setDescriptions([])
    setSelection({ work_experience: [], education: [], skills: [] })
    setFile(null)
    setError(null)
    setStep('describe')
  }

  const updateHeader = (field: keyof Pick<ResumeData, 'name' | 'phone' | 'email' | 'linkedin_url' | 'location'>, value: string) =>
    setResumeData(prev => prev ? { ...prev, [field]: value } : prev)

  const updateCompany = (ci: number, field: 'company' | 'location', value: string) =>
    setResumeData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        work_experience: prev.work_experience.map((c, i) =>
          i === ci ? { ...c, [field]: value } : c
        )
      }
    })

  const deleteCompany = (ci: number) => {
    if (!resumeData || !selection) return
    const [start, end] = descriptionRangeForCompany(resumeData, ci)
    setDescriptions(prev => {
      const n = [...prev]
      n.splice(start, end - start)
      return n
    })
    setSelection(prev => {
      if (!prev) return prev
      return { ...prev, work_experience: prev.work_experience.filter((_, i) => i !== ci) }
    })
    setResumeData(prev => {
      if (!prev) return prev
      return { ...prev, work_experience: prev.work_experience.filter((_, i) => i !== ci) }
    })
  }

  const addCompany = () => {
    setDescriptions(prev => [...prev, ''])
    setSelection(prev => prev ? { ...prev, work_experience: [...prev.work_experience, [true]] } : prev)
    setResumeData(prev => prev ? {
      ...prev,
      work_experience: [...prev.work_experience, {
        company: '',
        location: '',
        positions: [{ title: '', start_date: '', end_date: '', location: '', linkedin_description: '' }]
      }]
    } : prev)
  }

  const addPosition = (ci: number) => {
    if (!resumeData) return
    const fi = flatIndex(resumeData, ci, resumeData.work_experience[ci].positions.length)
    setDescriptions(prev => insertDescriptionAt(prev, fi))
    setSelection(prev => {
      if (!prev) return prev
      const we = prev.work_experience.map((row, i) => i === ci ? [...row, true] : row)
      return { ...prev, work_experience: we }
    })
    setResumeData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        work_experience: prev.work_experience.map((c, i) =>
          i === ci ? {
            ...c,
            positions: [...c.positions, { title: '', start_date: '', end_date: '', location: '', linkedin_description: '' }]
          } : c
        )
      }
    })
  }

  const deletePosition = (ci: number, pi: number) => {
    if (!resumeData) return
    if (resumeData.work_experience[ci].positions.length === 1) {
      deleteCompany(ci)
      return
    }
    const fi = flatIndex(resumeData, ci, pi)
    setDescriptions(prev => deleteDescriptionAt(prev, fi))
    setSelection(prev => {
      if (!prev) return prev
      const we = prev.work_experience.map((row, i) => i === ci ? row.filter((_, j) => j !== pi) : row)
      return { ...prev, work_experience: we }
    })
    setResumeData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        work_experience: prev.work_experience.map((c, i) =>
          i === ci ? { ...c, positions: c.positions.filter((_, j) => j !== pi) } : c
        )
      }
    })
  }

  const updatePosition = (ci: number, pi: number, field: keyof Omit<Position, 'linkedin_description'>, value: string) =>
    setResumeData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        work_experience: prev.work_experience.map((c, i) =>
          i === ci ? {
            ...c,
            positions: c.positions.map((p, j) => j === pi ? { ...p, [field]: value } : p)
          } : c
        )
      }
    })

  const addEducation = () => {
    setSelection(prev => prev ? { ...prev, education: [...prev.education, true] } : prev)
    setResumeData(prev => prev ? {
      ...prev,
      education: [...prev.education, { school: '', degree: '', start_date: '', end_date: '', location: '' }]
    } : prev)
  }

  const deleteEducation = (i: number) => {
    setSelection(prev => prev ? { ...prev, education: prev.education.filter((_, j) => j !== i) } : prev)
    setResumeData(prev => prev ? { ...prev, education: prev.education.filter((_, j) => j !== i) } : prev)
  }

  const updateEducation = (i: number, field: keyof Education, value: string) =>
    setResumeData(prev => prev ? {
      ...prev,
      education: prev.education.map((e, j) => j === i ? { ...e, [field]: value } : e)
    } : prev)

  const addSkill = () => {
    setSelection(prev => prev ? { ...prev, skills: [...prev.skills, true] } : prev)
    setResumeData(prev => prev ? {
      ...prev,
      skills: [...prev.skills, { category: '', skills: '' }]
    } : prev)
  }

  const deleteSkill = (i: number) => {
    setSelection(prev => prev ? { ...prev, skills: prev.skills.filter((_, j) => j !== i) } : prev)
    setResumeData(prev => prev ? { ...prev, skills: prev.skills.filter((_, j) => j !== i) } : prev)
  }

  const updateSkill = (i: number, field: keyof SkillCategory, value: string) =>
    setResumeData(prev => prev ? {
      ...prev,
      skills: prev.skills.map((s, j) => j === i ? { ...s, [field]: value } : s)
    } : prev)

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
        body: JSON.stringify({ resumeData: filteredResumeData, descriptions: filteredDescriptions }),
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

  const isManualEntry = !resumeData?.work_experience.some(c =>
    c.positions.some(p => p.linkedin_description))

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
            Upload your LinkedIn PDF or build your CV from scratch.
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

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              onClick={handleStartFromScratch}
              className="mt-4 w-full py-3 px-6 rounded-xl font-semibold text-gray-700 text-base
                border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Start from scratch
            </button>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2 — Describe roles                                             */}
        {/* ------------------------------------------------------------------ */}
        {step === 'describe' && resumeData && selection && (
          <>
            <p className="text-gray-500 text-sm mb-6">
              {isManualEntry
                ? 'Fill in your details below.'
                : 'Describe what you did in each role — Claude will turn your notes into polished bullet points. Leave a field blank and it will infer from the job title. Anything Claude already found on your LinkedIn profile is shown in grey. Uncheck any item to exclude it from the resume.'}
            </p>

            {/* Personal Details */}
            <SectionBlock title="Personal Details">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4 space-y-2">
                <input
                  className={inputCls}
                  value={resumeData.name}
                  onChange={e => updateHeader('name', e.target.value)}
                  placeholder="Full name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    value={resumeData.email}
                    onChange={e => updateHeader('email', e.target.value)}
                    placeholder="Email"
                  />
                  <input
                    className={inputCls}
                    value={resumeData.phone}
                    onChange={e => updateHeader('phone', e.target.value)}
                    placeholder="Phone"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    value={resumeData.linkedin_url}
                    onChange={e => updateHeader('linkedin_url', e.target.value)}
                    placeholder="LinkedIn URL"
                  />
                  <input
                    className={inputCls}
                    value={resumeData.location}
                    onChange={e => updateHeader('location', e.target.value)}
                    placeholder="Location"
                  />
                </div>
              </div>
            </SectionBlock>

            {/* Work Experience */}
            <SectionBlock title="Work Experience">
              {resumeData.work_experience.map((company, ci) => (
                <div
                  key={ci}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Company header */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <input
                        className={`${inputCls} font-semibold text-gray-900`}
                        value={company.company}
                        onChange={e => updateCompany(ci, 'company', e.target.value)}
                        placeholder="Company name"
                      />
                      <input
                        className={`${inputCls} text-xs text-gray-500`}
                        value={company.location}
                        onChange={e => updateCompany(ci, 'location', e.target.value)}
                        placeholder="Location"
                      />
                    </div>
                    <button
                      onClick={() => deleteCompany(ci)}
                      className="mt-0.5 text-gray-300 hover:text-red-400 transition-colors text-sm leading-none px-1 py-0.5"
                      title="Remove company"
                    >
                      ✕
                    </button>
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
                            <div className="grid grid-cols-2 gap-1.5 pr-10">
                              <input
                                className={`${inputCls} col-span-2 font-medium`}
                                value={pos.title}
                                onChange={e => updatePosition(ci, pi, 'title', e.target.value)}
                                placeholder="Job title"
                              />
                              <input
                                className={inputCls}
                                value={pos.start_date}
                                onChange={e => updatePosition(ci, pi, 'start_date', e.target.value)}
                                placeholder="Start date"
                              />
                              <input
                                className={inputCls}
                                value={pos.end_date}
                                onChange={e => updatePosition(ci, pi, 'end_date', e.target.value)}
                                placeholder="End date"
                              />
                              <input
                                className={`${inputCls} col-span-2`}
                                value={pos.location}
                                onChange={e => updatePosition(ci, pi, 'location', e.target.value)}
                                placeholder="Location"
                              />
                            </div>
                            <input
                              type="checkbox"
                              className="absolute top-3 right-4 h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0"
                              checked={enabled}
                              onChange={() => togglePosition(ci, pi)}
                            />
                            <button
                              onClick={() => deletePosition(ci, pi)}
                              className={`absolute top-9 right-3.5 text-xs leading-none transition-colors px-0.5 ${
                                company.positions.length === 1
                                  ? 'text-gray-200'
                                  : 'text-gray-300 hover:text-red-400'
                              }`}
                              title={company.positions.length === 1 ? 'Remove company' : 'Remove position'}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Position body */}
                          <div className="px-5 py-4">
                            {enabled && pos.linkedin_description && (
                              <p className="text-xs text-gray-400 italic mb-2 leading-relaxed">
                                {pos.linkedin_description}
                              </p>
                            )}
                            {enabled && (
                              <textarea
                                className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-800
                                  placeholder-gray-400 resize-none focus:outline-none focus:ring-2
                                  focus:ring-blue-400 focus:border-transparent transition"
                                rows={3}
                                placeholder="Describe your responsibilities and achievements…"
                                value={descriptions[fi] ?? ''}
                                onChange={(e) => setDescription(fi, e.target.value)}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add position button */}
                  <button
                    onClick={() => addPosition(ci)}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-dashed border-gray-100"
                  >
                    + Add position
                  </button>
                </div>
              ))}
            </SectionBlock>

            {/* Add company button */}
            <button onClick={addCompany} className={dashedBtnCls}>
              + Add company
            </button>

            {/* Education */}
            <SectionBlock title="Education">
              {resumeData.education.map((edu, i) => {
                const enabled = selection.education[i] ?? true
                return (
                  <div
                    key={i}
                    className={`bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 transition-opacity ${!enabled ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <input
                          className={`${inputCls} font-semibold text-gray-900`}
                          value={edu.school}
                          onChange={e => updateEducation(i, 'school', e.target.value)}
                          placeholder="School"
                        />
                        <input
                          className={inputCls}
                          value={edu.degree}
                          onChange={e => updateEducation(i, 'degree', e.target.value)}
                          placeholder="Degree"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            className={inputCls}
                            value={edu.start_date}
                            onChange={e => updateEducation(i, 'start_date', e.target.value)}
                            placeholder="Start date"
                          />
                          <input
                            className={inputCls}
                            value={edu.end_date}
                            onChange={e => updateEducation(i, 'end_date', e.target.value)}
                            placeholder="End date"
                          />
                          <input
                            className={`${inputCls} col-span-2`}
                            value={edu.location}
                            onChange={e => updateEducation(i, 'location', e.target.value)}
                            placeholder="Location"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2 mt-0.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0"
                          checked={enabled}
                          onChange={() => toggleFlat('education', i)}
                        />
                        <button
                          onClick={() => deleteEducation(i)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-xs leading-none"
                          title="Remove education"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </SectionBlock>

            {/* Add education button */}
            <button onClick={addEducation} className={dashedBtnCls}>
              + Add education
            </button>

            {/* Skills */}
            <SectionBlock title="Skills">
              {resumeData.skills.map((cat, i) => {
                const enabled = selection.skills[i] ?? true
                return (
                  <div
                    key={i}
                    className={`bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-3 transition-opacity ${!enabled ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <input
                          className={`${inputCls} font-semibold text-gray-900`}
                          value={cat.category}
                          onChange={e => updateSkill(i, 'category', e.target.value)}
                          placeholder="Category (e.g. Languages)"
                        />
                        <input
                          className={inputCls}
                          value={cat.skills}
                          onChange={e => updateSkill(i, 'skills', e.target.value)}
                          placeholder="Skills (e.g. TypeScript, Python, Rust)"
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 mt-0.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0"
                          checked={enabled}
                          onChange={() => toggleFlat('skills', i)}
                        />
                        <button
                          onClick={() => deleteSkill(i)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-xs leading-none"
                          title="Remove skill category"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </SectionBlock>

            {/* Add skill button */}
            <button onClick={addSkill} className={dashedBtnCls}>
              + Add skill category
            </button>

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
