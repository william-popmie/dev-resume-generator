import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ResumeData, GitHubProject } from "./types";
import type { BulletsMap, ProjectBulletsMap } from "./latex/sections";
import { buildHeader, buildExperience, buildEducation, buildSkills, buildProjects } from "./latex/sections";

export async function renderAndCompile(
  data: ResumeData,
  bullets: BulletsMap,
  template: string = 'formal',
  projects?: GitHubProject[],
  projectBullets?: ProjectBulletsMap,
): Promise<Buffer> {
  const templateFile = path.join(process.cwd(), `latex-templates/${template}-template/template.tex`);
  const tmpDir = path.join(os.tmpdir(), `resume-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const hasProjects = (projects?.length ?? 0) > 0;

  try {
    let tex = fs.readFileSync(templateFile, "utf8");
    tex = tex.replace("%%HEADER%%", buildHeader(data));
    tex = tex.replace("%%EXPERIENCE%%", buildExperience(data, bullets));
    tex = tex.replace("%%PROJECTS%%", hasProjects ? buildProjects(projects!, projectBullets ?? {}) : "");
    tex = tex.replace("%%EDUCATION%%", buildEducation(data));
    tex = tex.replace("%%SKILLS%%", buildSkills(data));

    fs.writeFileSync(path.join(tmpDir, "resume.tex"), tex);

    // pdflatex twice to resolve references
    const cmd = `pdflatex -interaction=nonstopmode -halt-on-error resume.tex`;
    for (let i = 0; i < 2; i++) {
      try {
        execSync(cmd, { cwd: tmpDir, stdio: "pipe" });
      } catch (err: any) {
        const pdfPath = path.join(tmpDir, "resume.pdf");
        if (!fs.existsSync(pdfPath)) {
          const log = fs.existsSync(path.join(tmpDir, "resume.log"))
            ? fs.readFileSync(path.join(tmpDir, "resume.log"), "utf8")
            : err.stdout?.toString() ?? "";
          throw new Error(`pdflatex failed:\n${log}`);
        }
      }
    }

    const pdfPath = path.join(tmpDir, "resume.pdf");
    if (!fs.existsSync(pdfPath)) throw new Error("PDF not produced");

    return fs.readFileSync(pdfPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
