import fs from 'fs'
import path from 'path'

export interface Template {
  main: string
  preamblePath: string
}

export function loadTemplate(name: string): Template {
  const templateDir = path.join(process.cwd(), 'latex-templates', name)
  const mainPath = path.join(templateDir, 'main.tex')
  const preamblePath = path.join(templateDir, 'preamble.tex')

  if (!fs.existsSync(mainPath)) {
    throw new Error(`Template '${name}' not found at ${mainPath}`)
  }

  const main = fs.readFileSync(mainPath, 'utf-8')
  return { main, preamblePath }
}
