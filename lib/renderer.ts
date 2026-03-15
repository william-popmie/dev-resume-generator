import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ResumeData } from "./types";
import type { BulletsMap } from "./latex/sections";
import { buildHeader, buildExperience, buildEducation, buildSkills } from "./latex/sections";

const TEMPLATE_FILE = path.join(process.cwd(), "latex-templates/modern-template/template.tex");

export async function renderAndCompile(
  data: ResumeData,
  bullets: BulletsMap,
): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `resume-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    let tex = fs.readFileSync(TEMPLATE_FILE, "utf8");
    tex = tex.replace("%%HEADER%%", buildHeader(data));
    tex = tex.replace("%%EXPERIENCE%%", buildExperience(data, bullets));
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
