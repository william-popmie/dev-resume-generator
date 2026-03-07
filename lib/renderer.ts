import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { loadTemplate } from './latex/templates'
import { buildHeader, buildExperience, buildEducation, buildSkills } from './latex/sections'
import type { ResumeData } from './types'

const execFileAsync = promisify(execFile)

const PDFLATEX = '/Library/TeX/texbin/pdflatex'

async function runPdflatex(tmpDir: string): Promise<void> {
  const args = [
    '-interaction=nonstopmode',
    '-output-directory', tmpDir,
    path.join(tmpDir, 'main.tex'),
  ]
  try {
    await execFileAsync(PDFLATEX, args, { cwd: tmpDir })
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const log = e.stdout ?? e.stderr ?? e.message ?? 'unknown error'
    // Extract the most useful part of the pdflatex log (lines starting with !)
    const errorLines = log.split('\n').filter(l => l.startsWith('!')).join('\n')
    throw new Error(`pdflatex failed:\n${errorLines || log.slice(0, 800)}`)
  }
}

export async function renderAndCompile(resumeData: ResumeData, bullets: string[][]): Promise<Buffer> {
  const { main, preamblePath } = loadTemplate('modern-template')

  const latex = main
    .replace('%%HEADER%%', buildHeader(resumeData))
    .replace('%%EXPERIENCE%%', buildExperience(resumeData.work_experience, bullets))
    .replace('%%EDUCATION%%', buildEducation(resumeData.education))
    .replace('%%SKILLS%%', buildSkills(resumeData.skills))

  const tmpDir = path.join(os.tmpdir(), `resume-${crypto.randomUUID()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    fs.writeFileSync(path.join(tmpDir, 'main.tex'), latex, 'utf-8')
    fs.copyFileSync(preamblePath, path.join(tmpDir, 'preamble.tex'))

    // Run twice to resolve references
    await runPdflatex(tmpDir)
    await runPdflatex(tmpDir)

    const pdfPath = path.join(tmpDir, 'main.pdf')
    if (!fs.existsSync(pdfPath)) {
      throw new Error('pdflatex did not produce a PDF')
    }

    return fs.readFileSync(pdfPath)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
