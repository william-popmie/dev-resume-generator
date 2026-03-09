/**
 * Single-pass LaTeX escaping. Never call this twice on the same string.
 * Characters above U+024F (outside Latin Extended-B) are stripped — pdflatex
 * with T1 encoding cannot render CJK, Arabic, etc.
 */
export function escapeTex(text: string): string {
  let result = "";
  for (const char of text) {
    if (char.codePointAt(0)! > 0x024f) continue; // drop non-Latin-Extended chars
    switch (char) {
      case "&":  result += "\\&"; break;
      case "%":  result += "\\%"; break;
      case "$":  result += "\\$"; break;
      case "#":  result += "\\#"; break;
      case "_":  result += "\\_"; break;
      case "{":  result += "\\{"; break;
      case "}":  result += "\\}"; break;
      case "~":  result += "\\textasciitilde{}"; break;
      case "^":  result += "\\textasciicircum{}"; break;
      case "\\":  result += "\\textbackslash{}"; break;
      default:   result += char;
    }
  }
  return result;
}
