import { escapeTex } from './escape'
import type { ResumeData, Company, Education, SkillCategory } from '../types'

export function buildHeader(data: ResumeData): string {
  const parts: string[] = []
  if (data.phone) parts.push(`\\texttt{${escapeTex(data.phone)}}`)
  if (data.email) parts.push(`\\texttt{${escapeTex(data.email)}}`)
  if (data.linkedin_url) parts.push(`\\href{${data.linkedin_url}}{\\texttt{LinkedIn}}`)
  if (data.location) parts.push(`\\texttt{${escapeTex(data.location)}}`)

  const contactLine = parts.join(' \\hspace{6pt} $|$ \\hspace{6pt} ')

  return `\\begin{center}
    \\textbf{\\Huge ${escapeTex(data.name)}} \\\\ \\vspace{5pt}
    \\small
    ${contactLine}
\\end{center}`
}

export function buildExperience(companies: Company[], bullets: string[][]): string {
  let flatIdx = 0
  const items: string[] = []

  for (const company of companies) {
    for (const pos of company.positions) {
      const positionBullets = bullets[flatIdx] ?? []
      flatIdx++

      const bulletItems = positionBullets
        .map(b => `        \\resumeItem{${escapeTex(b)}}`)
        .join('\n')

      const location = escapeTex(pos.location || company.location || '')
      items.push(
        `    \\resumeSubheading\n` +
        `    {${escapeTex(company.company)}}{${escapeTex(pos.start_date)} -- ${escapeTex(pos.end_date)}}\n` +
        `    {${escapeTex(pos.title)}}{${location}}\n` +
        `    \\resumeItemListStart\n` +
        bulletItems + '\n' +
        `    \\resumeItemListEnd`
      )
    }
  }

  return (
    `\\section{EXPERIENCE}\n` +
    `  \\resumeSubHeadingListStart\n\n` +
    items.join('\n\n') + '\n\n' +
    `  \\resumeSubHeadingListEnd`
  )
}

export function buildEducation(education: Education[]): string {
  const items = education.map(edu =>
    `\\resumeSubheading\n` +
    `{${escapeTex(edu.school)}}{${escapeTex(edu.start_date)} -- ${escapeTex(edu.end_date)}}\n` +
    `{${escapeTex(edu.degree)}}\n` +
    `{${escapeTex(edu.location)}}`
  )

  return (
    `\\section{EDUCATION}\n\n` +
    `\\resumeSubHeadingListStart\n\n` +
    items.join('\n\n') + '\n\n' +
    `\\resumeSubHeadingListEnd`
  )
}

export function buildSkills(skills: SkillCategory[]): string {
  const items = skills.map(s =>
    `\\resumeProjectHeading\n` +
    `{\\textbf{${escapeTex(s.category)}}}{}\n` +
    `\\resumeItemListStart\n` +
    `\\resumeItem{${escapeTex(s.skills)}}\n` +
    `\\resumeItemListEnd`
  )

  return (
    `\\section{SKILLS}\n\n` +
    `\\resumeSubHeadingListStart\n\n` +
    items.join('\n\n') + '\n\n' +
    `\\resumeSubHeadingListEnd`
  )
}
