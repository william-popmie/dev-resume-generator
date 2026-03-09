import Anthropic from "@anthropic-ai/sdk";
import type { ResumeData } from "./types";
import type { BulletsMap } from "./latex/sections";

const client = new Anthropic();

const BULLET_PROMPT = (
  title: string,
  company: string,
  linkedinDescription: string,
  userNotes: string,
) => `
You are writing resume bullet points for a ${title} role at ${company}.

LinkedIn description:
${linkedinDescription || "(none)"}

Additional context from the candidate:
${userNotes || "(none)"}

Write 3 concise, strong resume bullet points. Rules:
- Start each with an action verb
- Include a quantifiable result where possible
- Be specific, not generic
- No markdown, no numbering — just one bullet per line, using plain text
- Max 120 characters per bullet
`;

export async function generateBullets(
  data: ResumeData,
  userNotes: Record<string, string>, // key: "company|||title"
): Promise<BulletsMap> {
  const results: BulletsMap = {};

  for (const company of data.work_experience) {
    for (const pos of company.positions) {
      const key = `${company.company}|||${pos.title}`;
      const notes = userNotes[key] ?? "";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: BULLET_PROMPT(pos.title, company.company, pos.linkedin_description, notes),
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      const bullets = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 4); // max 4 bullets per role

      results[key] = bullets;
    }
  }

  return results;
}
