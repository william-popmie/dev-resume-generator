/**
 * Single-pass LaTeX escaping. Never call this twice on the same string.
 */
export function escapeTex(text: string): string {
  let result = "";
  for (const char of text) {
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
