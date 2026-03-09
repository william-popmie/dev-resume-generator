/**
 * test-latex.ts
 * Compiles the modern-template exactly as-is and writes output.pdf to the project root.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEMPLATE_DIR = path.resolve(
  __dirname,
  "../latex-templates/modern-template"
);
const OUTPUT_DIR = path.resolve(__dirname, "output");
const OUTPUT_PDF = path.join(OUTPUT_DIR, "output.pdf");

function main() {
  const tmpDir = path.join(os.tmpdir(), `resume-test-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Copy the entire template into a temp dir so pdflatex auxiliary files
    // don't pollute the source tree.
    execSync(`cp -r "${TEMPLATE_DIR}/." "${tmpDir}"`);

    // Run pdflatex twice (resolves references/page numbers).
    const cmd = `pdflatex -interaction=nonstopmode -halt-on-error main.tex`;
    for (let i = 0; i < 2; i++) {
      try {
        execSync(cmd, { cwd: tmpDir, stdio: "pipe" });
      } catch (err: any) {
        // pdflatex exits non-zero on warnings too; check if PDF was produced.
        const pdfPath = path.join(tmpDir, "main.pdf");
        if (!fs.existsSync(pdfPath)) {
          console.error("pdflatex failed. Log output:\n");
          console.error(err.stdout?.toString() ?? "");
          console.error(err.stderr?.toString() ?? "");
          process.exit(1);
        }
      }
    }

    const pdfPath = path.join(tmpDir, "main.pdf");
    if (!fs.existsSync(pdfPath)) {
      console.error("PDF was not produced. Check the log above.");
      process.exit(1);
    }

    fs.copyFileSync(pdfPath, OUTPUT_PDF);
    console.log(`PDF generated successfully: ${OUTPUT_PDF}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
