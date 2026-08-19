import { useEffect } from 'react'
import { tasksIn } from '../lib/useBoard'
import { COLUMNS, daysSince, formatDue, isOverdue, type Task } from '../lib/types'

const STALE_DAYS = 14

interface Props {
  tasks: Task[]
  lastReviewedAt: string | null
  onArchiveCompleted: () => void
  onOpen: (task: Task) => void
  onClose: () => void
}

export function WeeklyReview({
  tasks,
  lastReviewedAt,
  onArchiveCompleted,
  onOpen,
  onClose,
}: Props) {
  const overdue = tasks.filter(isOverdue)
  const stale = tasksIn(tasks, 'backlog').filter((task) => daysSince(task.updatedAt) >= STALE_DAYS)
  const finished = tasks.filter((task) => task.status === 'done')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="panel dialog review"
        role="dialog"
        aria-modal="true"
        aria-label="Weekly review"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">Weekly review</h2>
        <p className="muted">
          {lastReviewedAt
            ? `Last reviewed ${daysSince(lastReviewedAt)} days ago.`
            : 'First time through.'}{' '}
          About five calm minutes.
        </p>

        <section className="review-block">
          <h3>Where things stand</h3>
          <ul className="wip-list">
            {COLUMNS.map((column) => {
              const count = tasksIn(tasks, column.status).length
              const over = column.wip !== null && count > column.wip
              return (
                <li key={column.status}>
                  <span className={`dot dot-${column.status}`} aria-hidden="true" />
                  <span className="wip-label">{column.label}</span>
                  <span className={over ? 'count-over' : 'muted'}>
                    {column.wip === null ? count : `${count} / ${column.wip}`}
                    {over ? ' — over' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="review-block">
          <h3>Overdue ({overdue.length})</h3>
          {overdue.length === 0 ? (
            <p className="muted">Nothing overdue. Good.</p>
          ) : (
            <ul className="review-list">
              {overdue.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={() => onOpen(task)}>
                    <span>{task.title}</span>
                    <span className="chip chip-due chip-overdue">{formatDue(task.dueDate!)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="review-block">
          <h3>Sitting in Backlog ({stale.length})</h3>
          {stale.length === 0 ? (
            <p className="muted">Nothing has gone stale.</p>
          ) : (
            <>
              <p className="muted">Untouched for {STALE_DAYS} days or more. Promote or drop.</p>
              <ul className="review-list">
                {stale.map((task) => (
                  <li key={task.id}>
                    <button type="button" onClick={() => onOpen(task)}>
                      <span>{task.title}</span>
                      <span className="muted">{daysSince(task.updatedAt)}d</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="dialog-actions">
          <button
            className="btn"
            type="button"
            onClick={onArchiveCompleted}
            disabled={finished.length === 0}
          >
            Archive {finished.length} completed
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
