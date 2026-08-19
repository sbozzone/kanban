import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Column } from './Column'
import { CardDialog } from './CardDialog'
import { cardsIn, useCards } from '../lib/useCards'
import { supabase } from '../lib/supabase'
import { COLUMNS, type Card, type CardDraft, type Status } from '../lib/types'

type Editing = { card: Card | null } | null

export function Board({ session }: { session: Session }) {
  const { cards, loading, error, setError, create, edit, move, remove } = useCards(
    session.user.id,
  )
  const [editing, setEditing] = useState<Editing>(null)
  const [dragging, setDragging] = useState<Card | null>(null)

  function save(draft: CardDraft) {
    const card = editing?.card
    if (card) void edit(card.id, draft)
    else void create(draft)
    setEditing(null)
  }

  function destroy(card: Card) {
    void remove(card.id)
    setEditing(null)
  }

  /** Step a card one column over, landing at the bottom of the new column. */
  function step(card: Card, direction: -1 | 1) {
    const at = COLUMNS.findIndex((column) => column.status === card.status)
    const next = COLUMNS[at + direction]
    if (!next) return
    void move(card.id, next.status, cardsIn(cards, next.status).length)
  }

  function drop(status: Status, index: number) {
    if (dragging) void move(dragging.id, status, index)
    setDragging(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kanban</h1>
        <div className="topbar-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setEditing({ card: null })}
          >
            + New card
          </button>
          <button className="btn" type="button" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button className="icon-btn" type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted centered-text">Loading your board…</p>
      ) : (
        <main className="board">
          {COLUMNS.map((column, index) => (
            <Column
              key={column.status}
              status={column.status}
              label={column.label}
              cards={cardsIn(cards, column.status)}
              dragging={dragging}
              canMoveLeft={index > 0}
              canMoveRight={index < COLUMNS.length - 1}
              onOpen={(card) => setEditing({ card })}
              onMove={step}
              onDrop={drop}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
            />
          ))}
        </main>
      )}

      {editing && (
        <CardDialog
          card={editing.card}
          defaultStatus="todo"
          onSave={save}
          onDelete={destroy}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
