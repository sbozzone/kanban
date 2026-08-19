import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  COLUMNS,
  TAGS,
  type Priority,
  type Status,
  type Task,
  type TaskDraft,
} from '../lib/types'

interface Props {
  task: Task | null
  defaults: { status: Status; tag: string }
  onSave: (draft: TaskDraft) => void
  onDelete: (task: Task) => void
  onClose: () => void
}

export function TaskDialog({ task, defaults, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [tag, setTag] = useState(task?.tag ?? defaults.tag)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal')
  const [status, setStatus] = useState<Status>(task?.status ?? defaults.status)
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const panel = useRef<HTMLDivElement>(null)
  const titleField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleField.current?.focus()
  }, [])

  // Escape closes, and Tab is kept inside the dialog while it is open.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'input, textarea, select, button',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave({ title, note, tag, priority, status, dueDate: dueDate || null })
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="panel dialog"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={task ? 'Edit task' : 'New task'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h2 className="dialog-title">{task ? 'Edit task' : 'New task'}</h2>

          <label className="field">
            <span>Title</span>
            <input
              ref={titleField}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className="field">
            <span>Note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Tag</span>
              <select value={tag} onChange={(event) => setTag(event.target.value)}>
                {TAGS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Due</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Column</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
              >
                {COLUMNS.map((column) => (
                  <option key={column.status} value={column.status}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dialog-actions">
            {task && (
              <button className="btn btn-danger" type="button" onClick={() => onDelete(task)}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
