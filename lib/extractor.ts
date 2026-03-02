import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

// Gemini returns `null` for absent optional strings; normalise to `undefined`.
const optStr = z.string().nullish().transform((v) => v ?? undefined)

const WorkExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: optStr,
  start_date: z.string(),
  end_date: z.string(),
  bullets: z.array(z.string()),
})

const EducationSchema = z.object({
  institution: z.string(),
  degree: optStr,
  start_date: z.string(),
  end_date: z.string(),
  gpa: optStr,
  notes: optStr,
})

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  url: optStr,
})

export const ResumeDataSchema = z.object({
  full_name: z.string(),
  email: optStr,
  phone: optStr,
  linkedin_url: optStr,
  location: optStr,
  summary: optStr,
  skills: z.array(z.string()),
  work_experience: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
  projects: z.array(ProjectSchema).default([]),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type WorkExperience = z.infer<typeof WorkExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type Project = z.infer<typeof ProjectSchema>

// ---------------------------------------------------------------------------
// Extraction Prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Extract all resume information from this LinkedIn PDF export and return a single JSON object.

Use this exact structure:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "linkedin_url": "string or null",
  "location": "string or null",
  "summary": "string or null (the About/Summary section if present)",
  "skills": ["skill1", "skill2"],
  "work_experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "start_date": "string (e.g. Jan 2020)",
      "end_date": "string (e.g. Dec 2023 or Present)",
      "bullets": ["bullet 1", "bullet 2"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "start_date": "string",
      "end_date": "string",
      "gpa": "string or null",
      "notes": "string or null"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["tech1", "tech2"],
      "url": "string or null"
    }
  ]
}

Rules:
- List work experience in reverse chronological order (most recent first).
- For bullets: extract any listed bullets/descriptions from the PDF. If none exist for a role, generate 2-3 concise, impactful bullet points based on the job title and company context.
- Format dates consistently, e.g. "Jan 2020", "2020", or "Present".
- For optional fields that are absent, use null (not omit the key).
- For array fields that are absent, use [].
- Return ONLY the raw JSON object — no markdown fences, no prose.`

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function extractResumeData(
  buffer: Buffer,
  filename: string,
): Promise<ResumeData> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  let uploadedFileName: string | undefined

  try {
    // 1. Upload PDF buffer to Gemini File API
    const uploadedFile = await ai.files.upload({
      file: new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      config: { mimeType: 'application/pdf', displayName: filename },
    })

    if (!uploadedFile.uri || !uploadedFile.name) {
      throw new Error('File upload to Gemini failed: missing URI or name')
    }

    uploadedFileName = uploadedFile.name

    // 2. Extract structured data
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            {
              fileData: {
                mimeType: 'application/pdf',
                fileUri: uploadedFile.uri,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    const text = response.text
    if (!text) {
      throw new Error('Empty response from Gemini')
    }

    // 3. Parse and validate with Zod
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`)
    }

    return ResumeDataSchema.parse(parsed)
  } finally {
    // Always delete the file from Gemini servers
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName })
      } catch {
        // Ignore cleanup errors — file will expire automatically
      }
    }
  }
}
