export type Status = 'todo' | 'doing' | 'done'

export interface Card {
  id: string
  title: string
  note: string
  status: Status
  position: number
  created_at: string
  updated_at: string
}

/** The whole board is one document; `rev` guards against a stale overwrite. */
export interface Board {
  rev: number
  cards: Card[]
}

export interface CardDraft {
  title: string
  note: string
  status: Status
}

export const COLUMNS: { status: Status; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'In progress' },
  { status: 'done', label: 'Done' },
]
