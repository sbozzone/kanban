export type Status = 'backlog' | 'todo' | 'progress' | 'done'
export type Priority = 'normal' | 'high'

export interface Task {
  id: string
  title: string
  note: string
  tag: string
  priority: Priority
  status: Status
  position: number
  dueDate: string | null
  completedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Board {
  /** Bumped on every write, so a stale device cannot clobber a newer board. */
  rev: number
  tasks: Task[]
  archivedTasks: Task[]
  lastReviewedAt: string | null
}

export interface TaskDraft {
  title: string
  note: string
  tag: string
  priority: Priority
  status: Status
  dueDate: string | null
}

export interface ColumnSpec {
  status: Status
  label: string
  /** Soft limit: over it the column warns, it never blocks. */
  wip: number | null
}

export const COLUMNS: ColumnSpec[] = [
  { status: 'backlog', label: 'Backlog', wip: null },
  { status: 'todo', label: 'To Do', wip: 5 },
  { status: 'progress', label: 'In Progress', wip: 2 },
  { status: 'done', label: 'Done', wip: null },
]

export const TAGS = [
  'Personal',
  'Home',
  'Admin',
  'Health',
  'Finance',
  'Shop',
  'Church',
] as const

export const DONE: Status = 'done'

/** Local calendar date as YYYY-MM-DD — dates here are days, not instants. */
export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isOverdue(task: Task): boolean {
  return task.status !== DONE && task.dueDate !== null && task.dueDate < today()
}

export function isDueToday(task: Task): boolean {
  return task.dueDate !== null && task.dueDate <= today()
}

/** Friendly due date: "Today", "Tomorrow", "3 days ago", or a short date. */
export function formatDue(due: string): string {
  const start = new Date(`${today()}T00:00:00`)
  const target = new Date(`${due}T00:00:00`)
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${-days} days ago`
  if (days < 7) return `In ${days} days`
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
