import { useCallback, useEffect, useRef, useState } from 'react'
import { Conflict, Unauthorized, fetchBoard, saveBoard } from './api'
import { DONE, type Board, type Status, type Task, type TaskDraft } from './types'

const SPACING = 1024

/** Tasks in one column, in board order. */
export function tasksIn(tasks: Task[], status: Status): Task[] {
  return tasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

function positionFor(siblings: Task[], index: number): number {
  const before = siblings[index - 1]
  const after = siblings[index]
  if (!before && !after) return 0
  if (!before) return after.position - SPACING
  if (!after) return before.position + SPACING
  return (before.position + after.position) / 2
}

const EMPTY: Board = { rev: 0, tasks: [], archivedTasks: [], lastReviewedAt: null }

/** A change, expressed as a pure function so it can be replayed onto a newer board. */
type Change = (board: Board) => Omit<Board, 'rev'>

/** Most changes only touch the task list; this keeps the rest of the board intact. */
function overTasks(map: (board: Board) => Task[]): Change {
  return (board) => ({
    tasks: map(board),
    archivedTasks: board.archivedTasks,
    lastReviewedAt: board.lastReviewedAt,
  })
}

export function useBoard(onUnauthorized: () => void) {
  const [board, setBoard] = useState<Board>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

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

  // No realtime push, so pick up the other device's edits on returning to this
  // one. Skipped mid-save, which would otherwise race the write.
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
      apply({ rev: previous.rev, ...change(previous) })
      savingRef.current = true
      setSaving(true)

      try {
        apply(await saveBoard(boardRef.current))
        setError(null)
        setSavedAt(Date.now())
      } catch (cause) {
        if (cause instanceof Conflict) {
          try {
            apply(await saveBoard({ rev: cause.board.rev, ...change(cause.board) }))
            setError(null)
            setSavedAt(Date.now())
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
        setSaving(false)
      }
    },
    [apply, onUnauthorized],
  )

  const create = useCallback(
    (draft: TaskDraft) => {
      // Fixed up front so a replay reuses them rather than making a second task.
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit(
        overTasks((current) => {
          const siblings = tasksIn(current.tasks, draft.status)
          const last = siblings[siblings.length - 1]
          return [
            ...current.tasks,
            {
              id,
              title: draft.title.trim(),
              note: draft.note.trim(),
              tag: draft.tag,
              priority: draft.priority,
              status: draft.status,
              position: last ? last.position + SPACING : 0,
              dueDate: draft.dueDate,
              completedAt: draft.status === DONE ? now : null,
              archivedAt: null,
              createdAt: now,
              updatedAt: now,
            },
          ]
        }),
      )
    },
    [commit],
  )

  const update = useCallback(
    (id: string, draft: TaskDraft) => {
      const now = new Date().toISOString()
      return commit(
        overTasks((current) =>
          current.tasks.map((task) => {
            if (task.id !== id) return task
            const next: Task = {
              ...task,
              title: draft.title.trim(),
              note: draft.note.trim(),
              tag: draft.tag,
              priority: draft.priority,
              dueDate: draft.dueDate,
              updatedAt: now,
            }
            if (task.status === draft.status) return next

            const siblings = tasksIn(current.tasks, draft.status).filter((t) => t.id !== id)
            return {
              ...next,
              status: draft.status,
              position: positionFor(siblings, siblings.length),
              completedAt: draft.status === DONE ? (task.completedAt ?? now) : null,
            }
          }),
        ),
      )
    },
    [commit],
  )

  const move = useCallback(
    (id: string, status: Status, index: number) => {
      const now = new Date().toISOString()
      return commit(
        overTasks((current) => {
          const siblings = tasksIn(current.tasks, status).filter((task) => task.id !== id)
          const position = positionFor(siblings, Math.max(0, Math.min(index, siblings.length)))
          return current.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status,
                  position,
                  updatedAt: now,
                  completedAt: status === DONE ? (task.completedAt ?? now) : null,
                }
              : task,
          )
        }),
      )
    },
    [commit],
  )

  /** Shift a task one place up or down inside its own column. */
  const nudge = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = boardRef.current
      const task = current.tasks.find((candidate) => candidate.id === id)
      if (!task) return Promise.resolve()

      const column = tasksIn(current.tasks, task.status)
      const at = column.findIndex((candidate) => candidate.id === id)
      const to = at + direction
      if (to < 0 || to >= column.length) return Promise.resolve()

      // Removing self first means the target index counts the same either way.
      return move(id, task.status, direction === -1 ? to : to + 1)
    },
    [move],
  )

  const toggleDone = useCallback(
    (id: string) => {
      const now = new Date().toISOString()
      return commit(
        overTasks((current) => {
          const task = current.tasks.find((candidate) => candidate.id === id)
          if (!task) return current.tasks
          const finishing = task.status !== DONE
          const siblings = tasksIn(current.tasks, finishing ? DONE : 'todo').filter(
            (candidate) => candidate.id !== id,
          )
          return current.tasks.map((candidate) =>
            candidate.id === id
              ? {
                  ...candidate,
                  status: finishing ? DONE : 'todo',
                  completedAt: finishing ? now : null,
                  position: positionFor(siblings, siblings.length),
                  updatedAt: now,
                }
              : candidate,
          )
        }),
      )
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => commit(overTasks((current) => current.tasks.filter((t) => t.id !== id))),
    [commit],
  )

  /** Sweep the Done column into the archive, where it stays retrievable. */
  const archiveCompleted = useCallback(() => {
    const now = new Date().toISOString()
    return commit((current) => {
      const finished = current.tasks.filter((task) => task.status === DONE)
      return {
        tasks: current.tasks.filter((task) => task.status !== DONE),
        archivedTasks: [
          ...current.archivedTasks,
          ...finished.map((task) => ({ ...task, archivedAt: now })),
        ],
        lastReviewedAt: current.lastReviewedAt,
      }
    })
  }, [commit])

  const markReviewed = useCallback(
    () =>
      commit((current) => ({
        tasks: current.tasks,
        archivedTasks: current.archivedTasks,
        lastReviewedAt: new Date().toISOString(),
      })),
    [commit],
  )

  return {
    tasks: board.tasks,
    archivedTasks: board.archivedTasks,
    lastReviewedAt: board.lastReviewedAt,
    loading,
    error,
    setError,
    saving,
    savedAt,
    create,
    update,
    move,
    nudge,
    toggleDone,
    remove,
    archiveCompleted,
    markReviewed,
  }
}
