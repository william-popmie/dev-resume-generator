import Anthropic from '@anthropic-ai/sdk'
import type { ResumeData } from './types'

const client = new Anthropic()

export async function generateBullets(resumeData: ResumeData, descriptions: string[]): Promise<string[][]> {
  let flatIdx = 0
  const results: string[][] = []

  for (const company of resumeData.work_experience) {
    for (const pos of company.positions) {
      const description = descriptions[flatIdx] ?? ''
      const bullets = await generatePositionBullets(
        pos.title,
        company.company,
        description,
        pos.linkedin_description ?? '',
      )
      results.push(bullets)
      flatIdx++
    }
  }

  return results
}

async function generatePositionBullets(
  title: string,
  company: string,
  userDescription: string,
  linkedinDescription: string,
): Promise<string[]> {
  const contextParts: string[] = []
  if (userDescription) contextParts.push(`User notes: ${userDescription}`)
  if (linkedinDescription) contextParts.push(`LinkedIn description: ${linkedinDescription}`)
  const context = contextParts.join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Generate 3-4 strong resume bullet points for this position.

Role: ${title}
Company: ${company}
${context}

Rules:
- Start each bullet with a strong past-tense action verb (or "Present" role → present tense)
- Include specific metrics or impact where possible
- Keep each bullet concise (one line, under 120 characters)
- Return ONLY a JSON array of strings, no markdown, no explanation

Example: ["Led development of X, resulting in 30% faster Y", "Built Z using A and B"]`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const bullets = JSON.parse(text)
    if (Array.isArray(bullets)) return bullets.slice(0, 4).map(String)
    return []
  } catch {
    return text.split('\n').filter(l => l.trim()).slice(0, 4)
  }
}
