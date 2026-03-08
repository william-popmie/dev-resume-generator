/**
 * test-pipeline.ts
 * Full end-to-end test: parsed.json → bullets (Claude Haiku) → PDF (pdflatex)
 *
 * Usage: npm run test:pipeline
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const PARSED_JSON = path.resolve(__dirname, "output/parsed.json");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const OUTPUT_PDF = path.join(OUTPUT_DIR, "resume.pdf");

/**
 * Extra notes per position — keyed by "company|||title".
 * This simulates what the user would type in the frontend text fields.
 * Edit these to test different inputs.
 */
const USER_NOTES: Record<string, string> = {
  // "NEXT Leuven|||Startup Relations - Trip":
  //   "Secured 15 meetings with NYC VCs and founders. 40-person cohort. $2000 budget managed end-to-end.",
};

async function main() {
  const { generateBullets } = await import("../lib/generator");
  const { renderAndCompile } = await import("../lib/renderer");

  if (!fs.existsSync(PARSED_JSON)) {
    console.error(`Run 'npm run test:extract' first to generate ${PARSED_JSON}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(PARSED_JSON, "utf8"));

  console.log(`Generating bullets for ${data.work_experience.length} companies…`);
  const bullets = await generateBullets(data, USER_NOTES);

  console.log("\nGenerated bullets:");
  for (const [key, list] of Object.entries(bullets)) {
    const [company, title] = key.split("|||");
    console.log(`\n  ${company} — ${title}`);
    list.forEach((b) => console.log(`    • ${b}`));
  }

  console.log("\nCompiling PDF…");
  const pdf = await renderAndCompile(data, bullets);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PDF, pdf);
  console.log(`\nDone! PDF written to ${OUTPUT_PDF}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
