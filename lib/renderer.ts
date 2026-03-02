import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'
import type { ResumeData, WorkExperience, Education, Project } from './extractor'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// LaTeX Escaping
// ---------------------------------------------------------------------------

/**
 * Single-pass escape of all LaTeX special characters.
 * Using a single regex pass so substituted text is never re-processed.
 */
function escapeTex(s: string): string {
  return s.replace(/[\\{}&%$#_~^]/g, (char) => {
    switch (char) {
      case '\\': return '\\textbackslash{}'
      case '{':  return '\\{'
      case '}':  return '\\}'
      case '&':  return '\\&'
      case '%':  return '\\%'
      case '$':  return '\\$'
      case '#':  return '\\#'
      case '_':  return '\\_'
      case '~':  return '\\textasciitilde{}'
      case '^':  return '\\textasciicircum{}'
      default:   return char
    }
  })
}

// ---------------------------------------------------------------------------
// Section Generators
// ---------------------------------------------------------------------------

function generateHeader(data: ResumeData): string {
  const parts: string[] = []

  if (data.phone) parts.push(escapeTex(data.phone))
  if (data.email) {
    parts.push(`\\href{mailto:${data.email}}{\\underline{${escapeTex(data.email)}}}`)
  }
  if (data.linkedin_url) {
    const display = data.linkedin_url.replace(/^https?:\/\//i, '')
    parts.push(`\\href{${data.linkedin_url}}{\\underline{${escapeTex(display)}}}`)
  }
  if (data.location) parts.push(escapeTex(data.location))

  const contactLine = parts.join(' $|$ ')

  return `\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeTex(data.full_name)}} \\\\ \\vspace{1pt}
    \\small ${contactLine}
\\end{center}`
}

function generateSummarySection(summary: string | undefined): string {
  if (!summary?.trim()) return ''
  return `\\section{Summary}
${escapeTex(summary.trim())}`
}

function generateExperienceSection(jobs: WorkExperience[]): string {
  if (jobs.length === 0) return ''

  const items = jobs.map((job) => {
    const bullets = job.bullets.length > 0
      ? `      \\resumeItemListStart
${job.bullets.map((b) => `        \\resumeItem{${escapeTex(b)}}`).join('\n')}
      \\resumeItemListEnd`
      : ''

    return `    \\resumeSubheading
      {${escapeTex(job.company)}}{${escapeTex(job.start_date)} -- ${escapeTex(job.end_date)}}
      {${escapeTex(job.title)}}{${escapeTex(job.location ?? '')}}
${bullets}`
  })

  return `\\section{Experience}
  \\resumeSubHeadingListStart
${items.join('\n')}
  \\resumeSubHeadingListEnd`
}

function generateEducationSection(education: Education[]): string {
  if (education.length === 0) return ''

  const items = education.map((edu) => {
    const extraLines: string[] = []
    if (edu.gpa) extraLines.push(`GPA: ${escapeTex(edu.gpa)}`)
    if (edu.notes) extraLines.push(escapeTex(edu.notes))

    const extra = extraLines.length > 0
      ? `\n      \\resumeItemListStart\n${extraLines.map((l) => `        \\resumeItem{${l}}`).join('\n')}\n      \\resumeItemListEnd`
      : ''

    return `    \\resumeSubheading
      {${escapeTex(edu.institution)}}{${escapeTex(edu.start_date)} -- ${escapeTex(edu.end_date)}}
      {${escapeTex(edu.degree ?? '')}}{}${extra}`
  })

  return `\\section{Education}
  \\resumeSubHeadingListStart
${items.join('\n')}
  \\resumeSubHeadingListEnd`
}

function generateProjectsSection(projects: Project[]): string {
  if (projects.length === 0) return ''

  const items = projects.map((proj) => {
    const techStr = proj.technologies.map(escapeTex).join(', ')
    const heading = proj.url
      ? `\\textbf{\\href{${proj.url}}{${escapeTex(proj.name)}}} $|$ \\emph{${techStr}}`
      : `\\textbf{${escapeTex(proj.name)}} $|$ \\emph{${techStr}}`

    return `      \\resumeProjectHeading
          {${heading}}{}
          \\resumeItemListStart
            \\resumeItem{${escapeTex(proj.description)}}
          \\resumeItemListEnd`
  })

  return `\\section{Projects}
    \\resumeSubHeadingListStart
${items.join('\n')}
    \\resumeSubHeadingListEnd`
}

function generateSkillsSection(skills: string[]): string {
  if (skills.length === 0) return ''

  const skillList = skills.map(escapeTex).join(', ')

  return `\\section{Technical Skills}
\\noindent\\small{\\textbf{Skills:} ${skillList}}`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface RenderResult {
  pdfPath: string
  cleanup: () => Promise<void>
}

export async function renderAndCompile(data: ResumeData): Promise<RenderResult> {
  // 1. Read template
  const templatePath = path.join(process.cwd(), 'template.tex')
  let template: string
  try {
    template = await fs.readFile(templatePath, 'utf-8')
  } catch {
    throw new Error('template.tex not found in project root')
  }

  // 2. Generate each section
  const filled = template
    .replace('%%HEADER%%', generateHeader(data))
    .replace('%%SUMMARY_SECTION%%', generateSummarySection(data.summary))
    .replace('%%EXPERIENCE_SECTION%%', generateExperienceSection(data.work_experience))
    .replace('%%EDUCATION_SECTION%%', generateEducationSection(data.education))
    .replace('%%PROJECTS_SECTION%%', generateProjectsSection(data.projects))
    .replace('%%SKILLS_SECTION%%', generateSkillsSection(data.skills))

  // 3. Write to temp directory
  const workDir = path.join(os.tmpdir(), `resume-${randomUUID()}`)
  await fs.mkdir(workDir, { recursive: true })

  const texPath = path.join(workDir, 'resume.tex')
  await fs.writeFile(texPath, filled, 'utf-8')

  const cleanup = async () => {
    try {
      await fs.rm(workDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  try {
    // 4. Run pdflatex twice (second pass resolves references)
    for (let pass = 0; pass < 2; pass++) {
      await execFileAsync(
        'pdflatex',
        [
          '-interaction=nonstopmode',
          '-halt-on-error',
          '-output-directory', workDir,
          texPath,
        ],
        { cwd: workDir, timeout: 60_000 },
      )
    }
  } catch (err: unknown) {
    // Try to read the log for a more useful error message
    let logContent = ''
    try {
      logContent = await fs.readFile(path.join(workDir, 'resume.log'), 'utf-8')
      // Extract the first error line from the log
      const errorMatch = logContent.match(/^! .+$/m)
      if (errorMatch) {
        await cleanup()
        throw new Error(`pdflatex error: ${errorMatch[0]}`)
      }
    } catch (logErr) {
      if ((logErr as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Re-throw only if it's not a "log file not found" error
        await cleanup()
        throw logErr
      }
    }

    await cleanup()
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`pdflatex failed: ${message}`)
  }

  const pdfPath = path.join(workDir, 'resume.pdf')

  // Verify PDF was produced
  try {
    await fs.access(pdfPath)
  } catch {
    await cleanup()
    throw new Error('pdflatex ran but did not produce a PDF')
  }

  return { pdfPath, cleanup }
}
