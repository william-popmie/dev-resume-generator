import { escapeTex } from "./escape";
import type { ResumeData } from "../types";

/** Bullets keyed by "company|||title" */
export type BulletsMap = Record<string, string[]>;

export function buildHeader(data: ResumeData): string {
  const e = escapeTex;
  const lines: string[] = [
    `\\begin{center}`,
    `    \\textbf{\\Huge ${e(data.name)}} \\\\ \\vspace{5pt}`,
    `    \\small`,
  ];

  const parts: string[] = [];
  if (data.phone)        parts.push(`\\texttt{${e(data.phone)}}`);
  if (data.email)        parts.push(`\\texttt{${e(data.email)}}`);
  if (data.linkedin_url) parts.push(`\\href{${data.linkedin_url}}{\\texttt{LinkedIn}}`);
  if (data.location)     parts.push(`\\texttt{${e(data.location)}}`);

  lines.push("    " + parts.join(" \\hspace{6pt} $|$ \\hspace{6pt} "));
  lines.push(`\\end{center}`);
  return lines.join("\n");
}

export function buildExperience(data: ResumeData, bullets: BulletsMap): string {
  const e = escapeTex;
  const lines: string[] = ["\\section{EXPERIENCE}", "  \\resumeSubHeadingListStart", ""];

  for (const company of data.work_experience) {
    for (const pos of company.positions) {
      const key = `${company.company}|||${pos.title}`;
      const positionBullets = bullets[key] ?? [];

      lines.push(
        `    \\resumeSubheading`,
        `    {${e(company.company)}}{${e(pos.start_date)} -- ${e(pos.end_date)}}`,
        `    {${e(pos.title)}}{${e(pos.location || company.location)}}`,
      );

      if (positionBullets.length > 0) {
        lines.push(`    \\resumeItemListStart`);
        for (const bullet of positionBullets) {
          lines.push(`        \\resumeItem{${e(bullet)}}`);
        }
        lines.push(`    \\resumeItemListEnd`);
      }

      lines.push("");
    }
  }

  lines.push("  \\resumeSubHeadingListEnd");
  return lines.join("\n");
}

export function buildEducation(data: ResumeData): string {
  const e = escapeTex;
  const lines: string[] = [
    "\\section{EDUCATION}",
    "",
    "\\resumeSubHeadingListStart",
    "",
  ];

  for (const edu of data.education) {
    lines.push(
      `\\resumeSubheading`,
      `{${e(edu.school)}}{${e(edu.start_date)} -- ${e(edu.end_date)}}`,
      `{${e(edu.degree)}}`,
      `{${e(edu.location)}}`,
      "",
    );
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines.join("\n");
}

export function buildSkills(data: ResumeData): string {
  const e = escapeTex;
  const lines: string[] = [
    "\\section{SKILLS}",
    "",
    "\\resumeSubHeadingListStart",
    "",
  ];

  for (const cat of data.skills) {
    lines.push(
      `\\resumeProjectHeading`,
      `{\\textbf{${e(cat.category)}}}{}`,
      `\\resumeItemListStart`,
      `\\resumeItem{${e(cat.skills)}}`,
      `\\resumeItemListEnd`,
      "",
    );
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines.join("\n");
}
