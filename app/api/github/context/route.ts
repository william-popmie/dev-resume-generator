import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GitHubProjectSchema } from '@/lib/types'
import type { GitHubProject } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = body.username
    const projects = z.array(GitHubProjectSchema).parse(body.projects)

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
    }

    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    const user = username.trim()

    const results = await Promise.allSettled(
      projects.map(async (proj) => {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(proj.name)}/readme`,
            { headers },
          )
          if (!res.ok) return { ...proj, readme: '' }
          const data = await res.json()
          const decoded = Buffer.from(data.content as string, 'base64').toString('utf-8')
          return { ...proj, readme: decoded.slice(0, 500) }
        } catch {
          return { ...proj, readme: '' }
        }
      }),
    )

    const enriched: GitHubProject[] = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...projects[i], readme: '' },
    )

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    console.error('[/api/github/context] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
