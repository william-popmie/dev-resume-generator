import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Retry helper — handles transient 429 / 503 from Gemini
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 5_000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const code =
        (err as { status?: number; code?: number })?.status ??
        (err as { status?: number; code?: number })?.code
      if (code !== 429 && code !== 503) throw err // non-retryable
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * 2 ** attempt // 5 s, 10 s, 20 s
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

// Gemini returns `null` for absent optional strings; normalise to `undefined`.
const optStr = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

const PositionSchema = z.object({
  title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  location: optStr,
  linkedin_description: optStr, // verbatim text the user wrote on LinkedIn
  bullets: z.array(z.string()),
});

const WorkExperienceSchema = z.object({
  company: z.string(),
  location: optStr, // company-level location (fallback)
  positions: z.array(PositionSchema), // most recent first
});

const EducationSchema = z.object({
  institution: z.string(),
  degree: optStr,
  start_date: z.string(),
  end_date: z.string(),
  gpa: optStr,
  notes: optStr,
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  url: optStr,
});

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
});

export type ResumeData = z.infer<typeof ResumeDataSchema>;
export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// Extraction Prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are extracting structured data from a LinkedIn PDF export.

## PDF layout
The PDF has TWO columns:
- LEFT column: contact info, top skills, certifications, honors/awards
- RIGHT column: name, headline, location, Experience section, Education section

Focus primarily on the RIGHT column for experience and education.

## How the Experience section is formatted
Each company appears as a bold heading. If the person held multiple roles at that company,
a total-duration line like "1 year 9 months" appears directly under the company name —
IGNORE that line entirely, it is not a position.

Each role (position) within a company then appears indented, formatted as:
  Position Title
  Month YYYY - Month YYYY (X months)   ← strip the "(X months)" part when extracting dates
  City, Region, Country                 ← greyed-out location line (may be absent)
  Description text...                   ← optional free-text description

## Concrete example
PDF text for one company with three roles:

  NEXT Leuven
  1 year 9 months                      ← IGNORE THIS LINE
  Startup Relations - Trip
  June 2025 - Present (10 months)
  Leuven, Flemish Region, Belgium
  Responsible for Student Startup Trip 2026 to New York

  Board Member
  August 2025 - Present (8 months)
  Leuven, Flemish Region, Belgium

  Holy Hack Organiser
  July 2024 - June 2025 (1 year)
  Leuven, Flemish Region, Belgium
  Organised a 24h Hackathon where students come up and prototype new startup ideas.

Correct JSON for that company:
{
  "company": "NEXT Leuven",
  "location": "Leuven, Flemish Region, Belgium",
  "positions": [
    {
      "title": "Startup Relations - Trip",
      "start_date": "Jun 2025",
      "end_date": "Present",
      "location": "Leuven, Flemish Region, Belgium",
      "linkedin_description": "Responsible for Student Startup Trip 2026 to New York",
      "bullets": []
    },
    {
      "title": "Board Member",
      "start_date": "Aug 2025",
      "end_date": "Present",
      "location": "Leuven, Flemish Region, Belgium",
      "linkedin_description": null,
      "bullets": []
    },
    {
      "title": "Holy Hack Organiser",
      "start_date": "Jul 2024",
      "end_date": "Jun 2025",
      "location": "Leuven, Flemish Region, Belgium",
      "linkedin_description": "Organised a 24h Hackathon where students come up and prototype new startup ideas.",
      "bullets": []
    }
  ]
}

## Full output schema
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "linkedin_url": "string or null",
  "location": "string or null",
  "summary": "string or null (About/Summary section if present)",
  "skills": ["skill1", "skill2"],
  "work_experience": [
    {
      "company": "string",
      "location": "string or null",
      "positions": [
        {
          "title": "string",
          "start_date": "string (e.g. 'Jun 2025' — no duration suffix)",
          "end_date": "string (e.g. 'Present' or 'Jun 2025')",
          "location": "string or null",
          "linkedin_description": "string or null",
          "bullets": []
        }
      ]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
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

## Rules
- Companies in reverse chronological order (most recent first).
- Positions within a company in reverse chronological order (most recent first).
- The "X years Y months" duration line under a company name is NOT a position — skip it.
- Strip the "(X months)" / "(X years)" suffix from all date strings.
- bullets: ALWAYS return an empty array []. Never generate bullet points.
- linkedin_description: copy verbatim. Use null if the role has no description text.
- For absent optional fields: null. For absent arrays: [].
- Return ONLY the raw JSON object — no markdown fences, no prose.`;

// ---------------------------------------------------------------------------
// Bullet Point Generation
// ---------------------------------------------------------------------------

export type BulletGenEntry = {
  company: string;
  title: string;
  start: string;
  end: string;
  description: string;
};

export async function generateBulletPoints(
  entries: BulletGenEntry[],
): Promise<string[][]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const prompt = `You are writing resume bullet points. For each job below, use the provided description
to generate exactly 3–4 concise, impactful bullet points in past tense.
If no description is given, infer from the job title and company.

Return a JSON array of arrays (one inner array per job, same order):
[["bullet 1", "bullet 2", "bullet 3"], ["bullet a", "bullet b"], ...]

Jobs:
${JSON.stringify(entries, null, 2)}

Return ONLY the raw JSON array — no markdown, no prose.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  );

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini (bullet generation)");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON for bullets: ${text.slice(0, 200)}`,
    );
  }

  return z.array(z.array(z.string())).parse(parsed);
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export async function extractResumeData(
  buffer: Buffer,
  filename: string,
): Promise<ResumeData> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  let uploadedFileName: string | undefined;

  try {
    // 1. Upload PDF buffer to Gemini File API
    const uploadedFile = await ai.files.upload({
      file: new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
      config: { mimeType: "application/pdf", displayName: filename },
    });

    if (!uploadedFile.uri || !uploadedFile.name) {
      throw new Error("File upload to Gemini failed: missing URI or name");
    }

    uploadedFileName = uploadedFile.name;

    // 2. Extract structured data
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            parts: [
              {
                fileData: {
                  mimeType: "application/pdf",
                  fileUri: uploadedFile.uri,
                },
              },
              { text: EXTRACTION_PROMPT },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    );

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    // 3. Parse and validate with Zod
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
    }

    return ResumeDataSchema.parse(parsed);
  } finally {
    // Always delete the file from Gemini servers
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Ignore cleanup errors — file will expire automatically
      }
    }
  }
}
