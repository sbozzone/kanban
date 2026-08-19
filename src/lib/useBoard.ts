import { useCallback, useEffect, useRef, useState } from 'react'
import { Conflict, Unauthorized, fetchBoard, saveBoard } from './api'
import type { Board, Card, CardDraft, Status } from './types'

const SPACING = 1024

/** Cards in one column, in board order. */
export function cardsIn(cards: Card[], status: Status): Card[] {
  return cards
    .filter((card) => card.status === status)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}

function positionFor(siblings: Card[], index: number): number {
  const before = siblings[index - 1]
  const after = siblings[index]
  if (!before && !after) return 0
  if (!before) return after.position - SPACING
  if (!after) return before.position + SPACING
  return (before.position + after.position) / 2
}

const EMPTY: Board = { rev: 0, cards: [] }

/** A change, expressed as a pure function so it can be replayed onto a newer board. */
type Change = (board: Board) => Card[]

export function useBoard(onUnauthorized: () => void) {
  const [board, setBoard] = useState<Board>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const boardRef = useRef<Board>(EMPTY)
  const savingRef = useRef(false)

  const apply = useCallback((next: Board) => {
    boardRef.current = next
    setBoard(next)
  }, [])

  const load = useCallback(async () => {
    try {
      apply(await fetchBoard())
      setError(null)
    } catch (cause) {
      if (cause instanceof Unauthorized) return onUnauthorized()
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [apply, onUnauthorized])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // No realtime here, so pick up the other device's edits when you come back
  // to this one. Skipped mid-save, which would otherwise race the write.
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'visible' && !savingRef.current) void load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  /** Apply a change locally, then persist it; on a conflict, replay it onto the winner. */
  const commit = useCallback(
    async (change: Change) => {
      const previous = boardRef.current
      apply({ rev: previous.rev, cards: change(previous) })
      savingRef.current = true

      try {
        apply(await saveBoard(boardRef.current))
        setError(null)
      } catch (cause) {
        if (cause instanceof Conflict) {
          try {
            const replayed: Board = { rev: cause.board.rev, cards: change(cause.board) }
            apply(await saveBoard(replayed))
            setError(null)
            return
          } catch {
            apply(cause.board)
            setError('That change collided with another device — reloaded the newer board.')
            return
          }
        }
        if (cause instanceof Unauthorized) return onUnauthorized()
        apply(previous)
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        savingRef.current = false
      }
    },
    [apply, onUnauthorized],
  )

  const create = useCallback(
    (draft: CardDraft) => {
      // Fixed up front so a replay reuses them rather than making a second card.
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit((current) => {
        const siblings = cardsIn(current.cards, draft.status)
        const last = siblings[siblings.length - 1]
        return [
          ...current.cards,
          {
            id,
            title: draft.title.trim(),
            note: draft.note.trim(),
            status: draft.status,
            position: last ? last.position + SPACING : 0,
            created_at: now,
            updated_at: now,
          },
        ]
      })
    },
    [commit],
  )

  const edit = useCallback(
    (id: string, draft: CardDraft) => {
      const now = new Date().toISOString()
      return commit((current) =>
        current.cards.map((card) => {
          if (card.id !== id) return card
          const next = {
            ...card,
            title: draft.title.trim(),
            note: draft.note.trim(),
            updated_at: now,
          }
          if (card.status === draft.status) return next
          const siblings = cardsIn(current.cards, draft.status).filter((c) => c.id !== id)
          return { ...next, status: draft.status, position: positionFor(siblings, siblings.length) }
        }),
      )
    },
    [commit],
  )

  const move = useCallback(
    (id: string, status: Status, index: number) => {
      const now = new Date().toISOString()
      return commit((current) => {
        const siblings = cardsIn(current.cards, status).filter((card) => card.id !== id)
        const position = positionFor(siblings, Math.max(0, Math.min(index, siblings.length)))
        return current.cards.map((card) =>
          card.id === id ? { ...card, status, position, updated_at: now } : card,
        )
      })
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => commit((current) => current.cards.filter((card) => card.id !== id)),
    [commit],
  )

  return { cards: board.cards, loading, error, setError, create, edit, move, remove }
}
