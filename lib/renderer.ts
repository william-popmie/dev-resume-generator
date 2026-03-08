import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ResumeData } from "./types";
import type { BulletsMap } from "./latex/sections";
import { buildHeader, buildExperience, buildEducation, buildSkills } from "./latex/sections";

const TEMPLATE_DIR = path.join(process.cwd(), "latex-templates/modern-template");

function buildMainTex(data: ResumeData, bullets: BulletsMap): string {
  return `\\documentclass[letterpaper,11pt]{article}

\\input{preamble}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

%----------HEADING----------
${buildHeader(data)}

\\input{sections/experience}
\\input{sections/education}
\\input{sections/skills}

\\end{document}
`;
}

export async function renderAndCompile(
  data: ResumeData,
  bullets: BulletsMap,
): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `resume-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Copy template (preamble.tex and section examples as reference, fonts, etc.)
    execSync(`cp -r "${TEMPLATE_DIR}/." "${tmpDir}"`);

    // Overwrite main.tex with generated content
    fs.writeFileSync(path.join(tmpDir, "main.tex"), buildMainTex(data, bullets));

    // Overwrite section files with generated content
    fs.writeFileSync(
      path.join(tmpDir, "sections", "experience.tex"),
      buildExperience(data, bullets),
    );
    fs.writeFileSync(
      path.join(tmpDir, "sections", "education.tex"),
      buildEducation(data),
    );
    fs.writeFileSync(
      path.join(tmpDir, "sections", "skills.tex"),
      buildSkills(data),
    );

    // pdflatex twice to resolve references
    const cmd = `pdflatex -interaction=nonstopmode -halt-on-error main.tex`;
    for (let i = 0; i < 2; i++) {
      try {
        execSync(cmd, { cwd: tmpDir, stdio: "pipe" });
      } catch (err: any) {
        const pdfPath = path.join(tmpDir, "main.pdf");
        if (!fs.existsSync(pdfPath)) {
          const log = fs.existsSync(path.join(tmpDir, "main.log"))
            ? fs.readFileSync(path.join(tmpDir, "main.log"), "utf8")
            : err.stdout?.toString() ?? "";
          throw new Error(`pdflatex failed:\n${log}`);
        }
      }
    }

    const pdfPath = path.join(tmpDir, "main.pdf");
    if (!fs.existsSync(pdfPath)) throw new Error("PDF not produced");

    return fs.readFileSync(pdfPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
