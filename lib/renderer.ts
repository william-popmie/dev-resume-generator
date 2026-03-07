import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { loadTemplate } from './latex/templates'
import { buildHeader, buildExperience, buildEducation, buildSkills } from './latex/sections'
import type { ResumeData } from './types'

const execFileAsync = promisify(execFile)

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

    const pdflatexArgs = [
      '-interaction=nonstopmode',
      '-output-directory', tmpDir,
      path.join(tmpDir, 'main.tex'),
    ]

    // Run twice to resolve references
    await execFileAsync('pdflatex', pdflatexArgs, { cwd: tmpDir })
    await execFileAsync('pdflatex', pdflatexArgs, { cwd: tmpDir })

    const pdfPath = path.join(tmpDir, 'main.pdf')
    if (!fs.existsSync(pdfPath)) {
      throw new Error('pdflatex did not produce output')
    }

    return fs.readFileSync(pdfPath)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
