import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Column } from './Column'
import { TaskDialog } from './TaskDialog'
import { WeeklyReview } from './WeeklyReview'
import { Toasts, useToasts } from './Toasts'
import { tasksIn, useBoard } from '../lib/useBoard'
import { useDrag } from '../lib/useDrag'
import {
  COLUMNS,
  TAGS,
  isDueToday,
  type Status,
  type Task,
  type TaskDraft,
} from '../lib/types'

const ALL_TAGS = 'All tags'

export function Board({ onLock }: { onLock: () => void }) {
  const board = useBoard(onLock)
  const { toasts, notify } = useToasts()

  const [editing, setEditing] = useState<{ task: Task | null } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [collapsed, setCollapsed] = useState<Status[]>([])
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string>(ALL_TAGS)
  const [todayOnly, setTodayOnly] = useState(false)
  const [capture, setCapture] = useState('')
  const captureField = useRef<HTMLInputElement>(null)

  const filtered = search.trim() !== '' || tag !== ALL_TAGS || todayOnly

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return board.tasks.filter((task) => {
      if (tag !== ALL_TAGS && task.tag !== tag) return false
      if (todayOnly && !isDueToday(task)) return false
      if (!needle) return true
      return (
        task.title.toLowerCase().includes(needle) || task.note.toLowerCase().includes(needle)
      )
    })
  }, [board.tasks, search, tag, todayOnly])

  const drop = useCallback(
    (taskId: string, status: Status, index: number) => {
      void board.move(taskId, status, index)
    },
    [board],
  )
  const drag = useDrag(drop)

  // `N` opens quick capture from anywhere that is not already a text field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        captureField.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submitCapture() {
    const title = capture.trim()
    if (!title) return
    void board.create({
      title,
      note: '',
      tag: tag === ALL_TAGS ? 'Personal' : tag,
      priority: 'normal',
      status: 'todo',
      dueDate: null,
    })
    setCapture('')
    notify('Task added to To Do.')
  }

  function save(draft: TaskDraft) {
    const task = editing?.task
    if (task) {
      void board.update(task.id, draft)
      notify('Task updated.')
    } else {
      void board.create(draft)
      notify('Task added.')
    }
    setEditing(null)
  }

  function destroy(task: Task) {
    void board.remove(task.id)
    setEditing(null)
    notify(`Deleted “${task.title}”.`)
  }

  function toggleDone(task: Task) {
    void board.toggleDone(task.id)
    notify(task.status === 'done' ? 'Moved back to To Do.' : 'Nice — marked done.')
  }

  function archiveCompleted() {
    const count = board.tasks.filter((task) => task.status === 'done').length
    void board.archiveCompleted()
    notify(`Archived ${count} completed.`)
  }

  function toggleCollapsed(status: Status) {
    setCollapsed((current) =>
      current.includes(status)
        ? current.filter((entry) => entry !== status)
        : [...current, status],
    )
  }

  return (
    <div className={`app${drag.dragging ? ' app-dragging' : ''}`}>
      <header className="topbar">
        <h1 className="wordmark">Cairn</h1>

        <div className="save-state" aria-live="polite">
          {board.saving ? 'Saving…' : board.savedAt ? 'Saved' : ''}
        </div>

        <div className="topbar-actions">
          <button
            className="btn"
            type="button"
            onClick={() => setReviewing(true)}
          >
            My week
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setEditing({ task: null })}
          >
            Add task
          </button>
          <button className="btn" type="button" onClick={onLock}>
            Lock
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="capture">
          <input
            ref={captureField}
            value={capture}
            placeholder="Quick capture — press N"
            onChange={(event) => setCapture(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitCapture()
              if (event.key === 'Escape') {
                setCapture('')
                event.currentTarget.blur()
              }
            }}
            aria-label="Quick capture a task"
          />
          <button className="btn" type="button" onClick={submitCapture} disabled={!capture.trim()}>
            Add
          </button>
        </div>

        <div className="filters">
          <input
            className="search"
            type="search"
            value={search}
            placeholder="Search"
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search titles and notes"
          />
          <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Filter by tag">
            <option>{ALL_TAGS}</option>
            {TAGS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            className={`btn${todayOnly ? ' btn-on' : ''}`}
            type="button"
            onClick={() => setTodayOnly((on) => !on)}
            aria-pressed={todayOnly}
          >
            Today
          </button>
          {filtered && (
            <button
              className="btn btn-quiet"
              type="button"
              onClick={() => {
                setSearch('')
                setTag(ALL_TAGS)
                setTodayOnly(false)
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered && <p className="filter-note">Filters are on — clear them to reorder or drag.</p>}

      {board.error && (
        <div className="banner" role="alert">
          <span>{board.error}</span>
          <button className="icon-btn" type="button" onClick={() => board.setError(null)}>
            ✕
          </button>
        </div>
      )}

      {board.loading ? (
        <p className="muted centered-text">Gathering your board…</p>
      ) : (
        <main className="board">
          {COLUMNS.map((spec) => (
            <Column
              key={spec.status}
              spec={spec}
              tasks={tasksIn(visible, spec.status)}
              total={tasksIn(board.tasks, spec.status).length}
              collapsed={collapsed.includes(spec.status)}
              onToggleCollapsed={toggleCollapsed}
              draggingId={drag.dragging?.task.id ?? null}
              target={drag.target}
              handleProps={(task) => (filtered ? {} : drag.handleProps(task))}
              onOpen={(task) => setEditing({ task })}
              onToggleDone={toggleDone}
              onNudge={(task, direction) => void board.nudge(task.id, direction)}
              onDelete={destroy}
              filtered={filtered}
            />
          ))}
        </main>
      )}

      {drag.dragging && (
        <div
          className="ghost"
          style={{ left: drag.dragging.x, top: drag.dragging.y }}
          aria-hidden="true"
        >
          {drag.dragging.task.title}
        </div>
      )}

      {editing && (
        <TaskDialog
          task={editing.task}
          defaults={{ status: 'todo', tag: tag === ALL_TAGS ? 'Personal' : tag }}
          onSave={save}
          onDelete={destroy}
          onClose={() => setEditing(null)}
        />
      )}

      {reviewing && (
        <WeeklyReview
          tasks={board.tasks}
          lastReviewedAt={board.lastReviewedAt}
          onArchiveCompleted={archiveCompleted}
          onOpen={(task) => {
            setReviewing(false)
            setEditing({ task })
          }}
          onClose={() => {
            // Stamped on finishing, so the modal can show when you last looked.
            void board.markReviewed()
            setReviewing(false)
          }}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  )
}
