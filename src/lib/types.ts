export type Status = 'todo' | 'doing' | 'done'

export interface Card {
  id: string
  user_id: string
  title: string
  note: string
  status: Status
  position: number
  created_at: string
  updated_at: string
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

export function columnLabel(status: Status): string {
  return COLUMNS.find((c) => c.status === status)?.label ?? status
}
