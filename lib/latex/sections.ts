import { escapeTex } from "./escape";
import type { ResumeData, GitHubProject } from "../types";

/** Bullets keyed by "company|||title" */
export type BulletsMap = Record<string, string[]>;

/** Bullets keyed by project name */
export type ProjectBulletsMap = Record<string, string[]>;

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
  if (data.work_experience.length === 0) return "";
  const e = escapeTex;
  const lines: string[] = ["\\section{EXPERIENCE}", "  \\resumeSubHeadingListStart", ""];

  for (const company of data.work_experience) {
    for (let i = 0; i < company.positions.length; i++) {
      const pos = company.positions[i];
      const key = `${company.company}|||${pos.title}`;
      const positionBullets = bullets[key] ?? [];
      const loc = pos.location || company.location || "";

      if (i === 0) {
        lines.push(
          `    \\resumeSubheading`,
          `    {${e(company.company)}}{${e(pos.start_date)} -- ${e(pos.end_date)}}`,
          `    {${e(pos.title)}}{${e(loc)}}`,
        );
      } else {
        lines.push(
          `    \\resumeSubheadingContinued`,
          `    {${e(pos.title)}}{${e(pos.start_date)} -- ${e(pos.end_date)}}{${e(loc)}}`,
        );
      }

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
  if (data.education.length === 0) return "";
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
  if (data.skills.length === 0) return "";
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

export function buildProjects(projects: GitHubProject[], bullets: ProjectBulletsMap): string {
  if (projects.length === 0) return "";
  const e = escapeTex;
  const lines: string[] = [
    "\\section{PROJECTS}",
    "",
    "\\resumeSubHeadingListStart",
    "",
  ];

  for (const project of projects) {
    const projectBullets = bullets[project.name] ?? [];
    lines.push(
      `\\resumeProjectHeading`,
      `{\\textbf{${e(project.name)}} $|$ \\href{${project.url}}{\\myuline{GitHub}}}{}`,
    );
    if (projectBullets.length > 0) {
      lines.push(`\\resumeItemListStart`);
      for (const bullet of projectBullets) {
        lines.push(`    \\resumeItem{${e(bullet)}}`);
      }
      lines.push(`\\resumeItemListEnd`);
    }
    lines.push("");
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines.join("\n");
}
