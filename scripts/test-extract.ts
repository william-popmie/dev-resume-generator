/**
 * test-extract.ts
 * Parses resume-example/Profile.pdf and writes the structured output to scripts/output/parsed.json
 * Also prints a human-readable summary to the console.
 *
 * Usage: npm run test:extract
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local BEFORE importing the extractor, which instantiates Anthropic at module level.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import type { ResumeData } from "../lib/types";

const PDF_PATH = path.resolve(__dirname, "../resume-example/Profile.pdf");
const OUTPUT_DIR = path.resolve(__dirname, "output");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "parsed.json");

function printSummary(data: ResumeData) {
  console.log("\n========================================");
  console.log(`  ${data.name}`);
  console.log(`  ${data.email}  |  ${data.phone}  |  ${data.location}`);
  if (data.linkedin_url) console.log(`  ${data.linkedin_url}`);
  console.log("========================================\n");

  console.log("── EXPERIENCE ──────────────────────────");
  for (const company of data.work_experience) {
    console.log(`\n  ${company.company}  (${company.location})`);
    for (const pos of company.positions) {
      console.log(`    • ${pos.title}  [${pos.start_date} – ${pos.end_date}]`);
      if (pos.linkedin_description) {
        const preview = pos.linkedin_description.slice(0, 120).replace(/\n/g, " ");
        console.log(`      "${preview}${pos.linkedin_description.length > 120 ? "…" : ""}"`);
      }
    }
  }

  console.log("\n── EDUCATION ───────────────────────────");
  for (const edu of data.education) {
    console.log(`  • ${edu.school}  —  ${edu.degree}  [${edu.start_date} – ${edu.end_date}]`);
  }

  console.log("\n── SKILLS ──────────────────────────────");
  for (const cat of data.skills) {
    console.log(`  ${cat.category}: ${cat.skills}`);
  }

  console.log("\n════════════════════════════════════════\n");
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  // Dynamic import so ANTHROPIC_API_KEY is set before Anthropic() is constructed.
  const { extractResumeData } = await import("../lib/extractor");

  console.log(`Parsing ${PDF_PATH} …`);
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const data = await extractResumeData(pdfBuffer);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2));
  console.log(`JSON written to ${OUTPUT_JSON}`);

  printSummary(data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
