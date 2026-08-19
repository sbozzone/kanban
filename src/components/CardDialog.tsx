import { useEffect, useRef, useState, type FormEvent } from 'react'
import { COLUMNS, type Card, type CardDraft, type Status } from '../lib/types'

interface Props {
  card: Card | null
  defaultStatus: Status
  onSave: (draft: CardDraft) => void
  onDelete: (card: Card) => void
  onClose: () => void
}

export function CardDialog({ card, defaultStatus, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card?.title ?? '')
  const [note, setNote] = useState(card?.note ?? '')
  const [status, setStatus] = useState<Status>(card?.status ?? defaultStatus)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave({ title, note, status })
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="panel dialog"
        role="dialog"
        aria-modal="true"
        aria-label={card ? 'Edit card' : 'New card'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h2 className="dialog-title">{card ? 'Edit card' : 'New card'}</h2>

          <label className="field">
            <span>Title</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
            />
          </label>

          <label className="field">
            <span>Column</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
              {COLUMNS.map((column) => (
                <option key={column.status} value={column.status}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>

          <div className="dialog-actions">
            {card && (
              <button className="btn btn-danger" type="button" onClick={() => onDelete(card)}>
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
