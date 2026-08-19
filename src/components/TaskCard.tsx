import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatDue, isOverdue, type Task } from '../lib/types'

interface Props {
  task: Task
  isDragging: boolean
  handleProps: Record<string, unknown>
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
  onNudge: (task: Task, direction: -1 | 1) => void
  onDelete: (task: Task) => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export function TaskCard({
  task,
  isDragging,
  handleProps,
  onOpen,
  onToggleDone,
  onNudge,
  onDelete,
  canMoveUp,
  canMoveDown,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const done = task.status === 'done'
  const overdue = isOverdue(task)

  // A pending confirm that is never answered should not linger.
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 5000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  function onKeyDown(event: KeyboardEvent) {
    if (!event.altKey) return
    if (event.key === 'ArrowUp' && canMoveUp) {
      event.preventDefault()
      onNudge(task, -1)
    }
    if (event.key === 'ArrowDown' && canMoveDown) {
      event.preventDefault()
      onNudge(task, 1)
    }
  }

  return (
    <article
      className={`card${isDragging ? ' card-dragging' : ''}${done ? ' card-done' : ''}${
        overdue ? ' card-overdue' : ''
      }${task.priority === 'high' ? ' card-high' : ''}`}
      data-task-id={task.id}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={task.title}
    >
      <div className="card-main">
        <button
          className="check"
          type="button"
          onClick={() => onToggleDone(task)}
          aria-pressed={done}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" done`}
        >
          {done ? '✓' : ''}
        </button>

        <button className="card-body" type="button" onClick={() => onOpen(task)}>
          <span className="card-title">{task.title}</span>
          {task.note && <span className="card-note">{task.note}</span>}
          <span className="card-meta">
            <span className={`chip chip-${task.tag.toLowerCase()}`}>{task.tag}</span>
            {task.priority === 'high' && <span className="chip chip-high">High</span>}
            {task.dueDate && (
              <span className={`chip chip-due${overdue ? ' chip-overdue' : ''}`}>
                {formatDue(task.dueDate)}
              </span>
            )}
          </span>
        </button>

        <div
          className="grip"
          title="Drag to move"
          aria-hidden="true"
          {...handleProps}
        >
          ⠿
        </div>
      </div>

      <div className="card-tools">
        <button
          className="icon-btn"
          type="button"
          onClick={() => onNudge(task, -1)}
          disabled={!canMoveUp}
          aria-label={`Move "${task.title}" up`}
        >
          ↑
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => onNudge(task, 1)}
          disabled={!canMoveDown}
          aria-label={`Move "${task.title}" down`}
        >
          ↓
        </button>
        <span className="spacer" />
        {confirming ? (
          <>
            <button
              className="icon-btn danger"
              type="button"
              onClick={() => onDelete(task)}
              aria-label={`Confirm delete "${task.title}"`}
            >
              Delete?
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Keep the task"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            className="icon-btn"
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete "${task.title}"`}
          >
            🗑
          </button>
        )}
      </div>
    </article>
  )
}
