import type { Board } from './types'

const STORAGE_KEY = 'cairn.passphrase'

/** The stored passphrase was rejected — the caller should ask for it again. */
export class Unauthorized extends Error {}

/** Another device wrote first; `board` is the version that won. */
export class Conflict extends Error {
  constructor(readonly board: Board) {
    super('The board changed on another device')
  }
}

export const readPassphrase = (): string | null => localStorage.getItem(STORAGE_KEY)
export const writePassphrase = (value: string) => localStorage.setItem(STORAGE_KEY, value)
export const clearPassphrase = () => localStorage.removeItem(STORAGE_KEY)

async function request(method: 'GET' | 'PUT', body?: Board, passphrase?: string): Promise<Board> {
  const secret = passphrase ?? readPassphrase() ?? ''
  const response = await fetch('/api/board', {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401) throw new Unauthorized('Wrong passphrase')
  if (response.status === 409) throw new Conflict((await response.json()) as Board)
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(detail.error ?? `The server said ${response.status}`)
  }
  return (await response.json()) as Board
}

export const fetchBoard = () => request('GET')
export const saveBoard = (board: Board) => request('PUT', board)

/** Check a passphrase against the server before keeping it. */
export async function unlock(passphrase: string): Promise<void> {
  await request('GET', undefined, passphrase)
  writePassphrase(passphrase)
}
