import Anthropic from '@anthropic-ai/sdk'
import { ResumeDataSchema } from './types'

export type { ResumeData } from './types'

const client = new Anthropic()

const EXTRACTION_PROMPT = `Extract all resume information from this LinkedIn PDF export and return it as JSON matching exactly this structure:

{
  "name": "Full Name",
  "phone": "+1 234 567 8900",
  "email": "email@example.com",
  "linkedin_url": "https://linkedin.com/in/username",
  "location": "City, Country",
  "work_experience": [
    {
      "company": "Company Name",
      "location": "City, Country",
      "positions": [
        {
          "title": "Job Title",
          "start_date": "Jan. 2023",
          "end_date": "Present",
          "location": "City, Country",
          "linkedin_description": "Any description text from LinkedIn for this role"
        }
      ]
    }
  ],
  "education": [
    {
      "school": "University Name",
      "degree": "Degree and field of study",
      "start_date": "Sept. 2020",
      "end_date": "Jun. 2024",
      "location": "City, Country"
    }
  ],
  "skills": [
    {
      "category": "Category Name",
      "skills": "Skill1, Skill2, Skill3"
    }
  ]
}

Rules:
- Group skills into logical categories (e.g. Programming Languages, Frameworks, Tools, Languages)
- If skills are listed without categories on LinkedIn, infer appropriate categories
- Use abbreviated month format for dates (e.g. "Jan. 2023", "Sept. 2020")
- Use "Present" for current roles
- If a field is missing, use an empty string
- Return ONLY valid JSON, no markdown, no explanation`

export async function extractResumeData(pdfBuffer: Buffer) {
  const base64Pdf = pdfBuffer.toString('base64')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64Pdf,
            },
          },
          {
            type: 'text' as const,
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON from Claude extractor')
  }

  return ResumeDataSchema.parse(parsed)
}
