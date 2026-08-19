import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'
import { Redis } from '@upstash/redis'

const KEY = 'cairn:board'

// Built on first use, so a missing variable surfaces as a handled 500 rather
// than a crash while the module is still loading.
let client: Redis | null = null

function redis(): Redis {
  if (!client) {
    // The Vercel Upstash integration has shipped under two env var names.
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
    if (!url || !token) {
      throw new Error('Upstash Redis credentials are not set on the server')
    }
    client = new Redis({ url, token })
  }
  return client
}

interface Board {
  rev: number
  tasks: Record<string, unknown>[]
  archivedTasks: Record<string, unknown>[]
  lastReviewedAt: string | null
}

const EMPTY: Board = { rev: 0, tasks: [], archivedTasks: [], lastReviewedAt: null }

const STATUSES = new Set(['backlog', 'todo', 'progress', 'done'])

/**
 * Upgrades whatever is in storage to the current shape. The board began as
 * `{ rev, cards }` with three columns and snake_case fields; reading through
 * this means an old document keeps working and is rewritten on its next save.
 */
function normalizeTask(raw: Record<string, unknown>): Record<string, unknown> {
  const status = raw.status === 'doing' ? 'progress' : raw.status
  const createdAt = (raw.createdAt ?? raw.created_at ?? new Date().toISOString()) as string
  const updatedAt = (raw.updatedAt ?? raw.updated_at ?? createdAt) as string
  const done = status === 'done'

  return {
    id: String(raw.id ?? crypto.randomUUID()),
    title: String(raw.title ?? ''),
    note: String(raw.note ?? ''),
    // "Chuch" was a typo in an earlier tag list; fix it on the way through.
    tag: raw.tag === 'Chuch' ? 'Church' : String(raw.tag ?? 'Personal'),
    priority: raw.priority === 'high' ? 'high' : 'normal',
    status: STATUSES.has(status as string) ? status : 'todo',
    position: typeof raw.position === 'number' ? raw.position : 0,
    dueDate: (raw.dueDate as string | null) ?? null,
    completedAt: (raw.completedAt as string | null) ?? (done ? updatedAt : null),
    archivedAt: (raw.archivedAt as string | null) ?? null,
    createdAt,
    updatedAt,
  }
}

function normalize(raw: unknown): Board {
  if (!raw || typeof raw !== 'object') return EMPTY
  const board = raw as Record<string, unknown>
  const tasks = (board.tasks ?? board.cards ?? []) as Record<string, unknown>[]
  const archived = (board.archivedTasks ?? []) as Record<string, unknown>[]

  return {
    rev: typeof board.rev === 'number' ? board.rev : 0,
    tasks: Array.isArray(tasks) ? tasks.map(normalizeTask) : [],
    archivedTasks: Array.isArray(archived) ? archived.map(normalizeTask) : [],
    lastReviewedAt: (board.lastReviewedAt as string | null) ?? null,
  }
}

function authorized(req: VercelRequest): boolean {
  const expected = process.env.BOARD_PASSPHRASE
  if (!expected) return false

  const offered = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  const a = Buffer.from(offered)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, which is itself a leak of
  // length — cheap to avoid, and the comparison is constant time from there.
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.BOARD_PASSPHRASE) {
    return res.status(500).json({ error: 'BOARD_PASSPHRASE is not set on the server' })
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Wrong passphrase' })
  }

  try {
    return await route(req, res)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return res.status(500).json({ error: detail })
  }
}

async function route(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(normalize(await redis().get(KEY)))
  }

  if (req.method === 'PUT') {
    const incoming = req.body as Board | undefined
    if (!incoming || typeof incoming.rev !== 'number' || !Array.isArray(incoming.tasks)) {
      return res.status(400).json({ error: 'Expected a board of { rev, tasks }' })
    }

    const current = normalize(await redis().get(KEY))
    if (incoming.rev !== current.rev) {
      // The other device wrote first. Hand back the winner so the caller can
      // replay its change onto it rather than silently losing either side.
      return res.status(409).json(current)
    }

    const next: Board = {
      rev: current.rev + 1,
      tasks: incoming.tasks,
      archivedTasks: Array.isArray(incoming.archivedTasks) ? incoming.archivedTasks : [],
      lastReviewedAt: incoming.lastReviewedAt ?? null,
    }
    await redis().set(KEY, next)
    return res.status(200).json(next)
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ error: `${req.method} not allowed` })
}
