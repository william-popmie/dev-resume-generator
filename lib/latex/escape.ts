export function escapeTex(str: string): string {
  let result = ''
  for (const char of str) {
    switch (char) {
      case '\\': result += '\\textbackslash{}'; break
      case '{':  result += '\\{'; break
      case '}':  result += '\\}'; break
      case '$':  result += '\\$'; break
      case '&':  result += '\\&'; break
      case '#':  result += '\\#'; break
      case '^':  result += '\\^{}'; break
      case '_':  result += '\\_'; break
      case '~':  result += '\\textasciitilde{}'; break
      case '%':  result += '\\%'; break
      default:   result += char
    }
  }
  return result
}
