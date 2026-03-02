'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState<string>('resume.pdf')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setFileIfPdf = (f: File) => {
    if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
      setFile(f)
      setError(null)
      setDownloadUrl(null)
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

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setDownloadUrl(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

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

        {/* Drop Zone */}
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
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
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

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!file || loading}
          className="mt-6 w-full py-3.5 px-6 rounded-xl font-semibold text-white text-lg transition-all
            bg-blue-600 hover:bg-blue-700 active:bg-blue-800
            disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Resume…
            </span>
          ) : (
            'Generate Resume'
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Download */}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={downloadName}
            className="mt-4 flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl
              font-semibold text-white text-lg bg-green-600 hover:bg-green-700 active:bg-green-800
              transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {downloadName}
          </a>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-gray-300 text-xs">
          Your PDF is processed by Gemini and immediately deleted. Nothing is stored.
        </p>
      </div>
    </main>
  )
}
