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
  /** Bumped on every write, so a stale device cannot clobber a newer board. */
  rev: number
  cards: unknown[]
}

const EMPTY: Board = { rev: 0, cards: [] }

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
    const board = (await redis().get<Board>(KEY)) ?? EMPTY
    return res.status(200).json(board)
  }

  if (req.method === 'PUT') {
    const incoming = req.body as Board | undefined
    if (!incoming || typeof incoming.rev !== 'number' || !Array.isArray(incoming.cards)) {
      return res.status(400).json({ error: 'Expected a board of { rev, cards }' })
    }

    const current = (await redis().get<Board>(KEY)) ?? EMPTY
    if (incoming.rev !== current.rev) {
      // The other device wrote first. Hand back the winner so the caller can
      // replay its change onto it rather than silently losing either side.
      return res.status(409).json(current)
    }

    const next: Board = { rev: current.rev + 1, cards: incoming.cards }
    await redis().set(KEY, next)
    return res.status(200).json(next)
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ error: `${req.method} not allowed` })
}
