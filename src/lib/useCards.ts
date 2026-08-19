import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Card, CardDraft, Status } from './types'

const SPACING = 1024

/** Cards in one column, in board order. */
export function cardsIn(cards: Card[], status: Status): Card[] {
  return cards
    .filter((card) => card.status === status)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}

/**
 * A position that lands the card at `index` of `siblings`. Sitting between the
 * neighbours rather than renumbering keeps a move to a single row update.
 */
function positionFor(siblings: Card[], index: number): number {
  const before = siblings[index - 1]
  const after = siblings[index]
  if (!before && !after) return 0
  if (!before) return after.position - SPACING
  if (!after) return before.position + SPACING
  return (before.position + after.position) / 2
}

export function useCards(userId: string | null) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mutations need the current board without going stale inside a callback.
  const cardsRef = useRef<Card[]>([])
  cardsRef.current = cards

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      const { data, error: loadError } = await supabase
        .from('cards')
        .select('*')
        .order('position', { ascending: true })
      if (cancelled) return
      if (loadError) setError(loadError.message)
      else setCards((data ?? []) as Card[])
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Realtime keeps a second device in step without a refresh.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`cards:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${userId}` },
        (payload) => {
          setCards((prev) => {
            if (payload.eventType === 'DELETE') {
              const gone = payload.old as Partial<Card>
              return prev.filter((card) => card.id !== gone.id)
            }
            const row = payload.new as Card
            const at = prev.findIndex((card) => card.id === row.id)
            if (at === -1) return [...prev, row]
            // The server row wins; our own echo is simply a no-op merge.
            const next = prev.slice()
            next[at] = row
            return next
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const create = useCallback(async (draft: CardDraft) => {
    const siblings = cardsIn(cardsRef.current, draft.status)
    const last = siblings[siblings.length - 1]
    const { data, error: insertError } = await supabase
      .from('cards')
      .insert({
        title: draft.title.trim(),
        note: draft.note.trim(),
        status: draft.status,
        position: last ? last.position + SPACING : 0,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }
    const row = data as Card
    setCards((prev) => (prev.some((card) => card.id === row.id) ? prev : [...prev, row]))
  }, [])

  /** Optimistic so the board never lags a tap; the server row replaces it on return. */
  const patch = useCallback(async (id: string, changes: Partial<Card>) => {
    const rollback = cardsRef.current
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...changes } : card)))

    const { data, error: updateError } = await supabase
      .from('cards')
      .update(changes)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      setCards(rollback)
      setError(updateError.message)
      return
    }
    const row = data as Card
    setCards((prev) => prev.map((card) => (card.id === row.id ? row : card)))
  }, [])

  const edit = useCallback(
    (id: string, draft: CardDraft) => {
      const current = cardsRef.current.find((card) => card.id === id)
      const changes: Partial<Card> = { title: draft.title.trim(), note: draft.note.trim() }
      if (current && current.status !== draft.status) {
        const siblings = cardsIn(cardsRef.current, draft.status).filter((card) => card.id !== id)
        changes.status = draft.status
        changes.position = positionFor(siblings, siblings.length)
      }
      return patch(id, changes)
    },
    [patch],
  )

  const move = useCallback(
    (id: string, status: Status, index: number) => {
      const siblings = cardsIn(cardsRef.current, status).filter((card) => card.id !== id)
      const clamped = Math.max(0, Math.min(index, siblings.length))
      return patch(id, { status, position: positionFor(siblings, clamped) })
    },
    [patch],
  )

  const remove = useCallback(async (id: string) => {
    const rollback = cardsRef.current
    setCards((prev) => prev.filter((card) => card.id !== id))

    const { error: deleteError } = await supabase.from('cards').delete().eq('id', id)
    if (deleteError) {
      setCards(rollback)
      setError(deleteError.message)
    }
  }, [])

  return { cards, loading, error, setError, create, edit, move, remove }
}
