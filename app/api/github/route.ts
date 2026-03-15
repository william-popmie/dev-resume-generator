import { NextRequest, NextResponse } from 'next/server'
import type { GitHubProject } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = body.username

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
    }

    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?sort=updated&per_page=100&type=public`,
      { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } },
    )

    if (res.status === 404) {
      return NextResponse.json({ error: `GitHub user "${username}" not found` }, { status: 404 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API error: ${res.status}` }, { status: 500 })
    }

    const raw = await res.json()

    const projects: GitHubProject[] = (raw as any[]).map((repo) => ({
      name: repo.name as string,
      description: (repo.description as string | null) ?? '',
      url: repo.html_url as string,
      language: (repo.language as string | null) ?? '',
      topics: (repo.topics as string[]) ?? [],
    }))

    return NextResponse.json(projects)
  } catch (err: unknown) {
    console.error('[/api/github] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
