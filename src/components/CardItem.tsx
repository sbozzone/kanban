import type { DragEvent } from 'react'
import type { Card } from '../lib/types'

interface Props {
  card: Card
  isDragging: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onOpen: (card: Card) => void
  onMove: (card: Card, direction: -1 | 1) => void
  onDragStart: (card: Card) => void
  onDragEnd: () => void
}

export function CardItem({
  card,
  isDragging,
  canMoveLeft,
  canMoveRight,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: Props) {
  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', card.id)
    onDragStart(card)
  }

  return (
    <article
      className={`card${isDragging ? ' card-dragging' : ''}`}
      data-card-id={card.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <button className="card-body" type="button" onClick={() => onOpen(card)}>
        <span className="card-title">{card.title}</span>
        {card.note && <span className="card-note">{card.note}</span>}
      </button>

      {/* Dragging is a desktop luxury; these work everywhere, touch included. */}
      <div className="card-moves">
        <button
          className="icon-btn"
          type="button"
          onClick={() => onMove(card, -1)}
          disabled={!canMoveLeft}
          aria-label={`Move "${card.title}" to the previous column`}
        >
          ‹
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => onMove(card, 1)}
          disabled={!canMoveRight}
          aria-label={`Move "${card.title}" to the next column`}
        >
          ›
        </button>
      </div>
    </article>
  )
}
