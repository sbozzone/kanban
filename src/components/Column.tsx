import { useRef, useState, type DragEvent } from 'react'
import { CardItem } from './CardItem'
import type { Card, Status } from '../lib/types'

interface Props {
  status: Status
  label: string
  cards: Card[]
  dragging: Card | null
  canMoveLeft: boolean
  canMoveRight: boolean
  onOpen: (card: Card) => void
  onMove: (card: Card, direction: -1 | 1) => void
  onDrop: (status: Status, index: number) => void
  onDragStart: (card: Card) => void
  onDragEnd: () => void
}

/** Where in the list a drop at `clientY` should land, ignoring the card being moved. */
function dropIndex(list: HTMLElement, clientY: number, draggingId: string): number {
  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-card-id]')).filter(
    (element) => element.dataset.cardId !== draggingId,
  )

  for (let i = 0; i < items.length; i += 1) {
    const box = items[i].getBoundingClientRect()
    if (clientY < box.top + box.height / 2) return i
  }
  return items.length
}

export function Column({
  status,
  label,
  cards,
  dragging,
  canMoveLeft,
  canMoveRight,
  onOpen,
  onMove,
  onDrop,
  onDragStart,
  onDragEnd,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!dragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setOver(true)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!dragging) return
    event.preventDefault()
    setOver(false)
    const list = listRef.current
    onDrop(status, list ? dropIndex(list, event.clientY, dragging.id) : cards.length)
  }

  return (
    <section
      className={`column column-${status}${over ? ' column-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      aria-label={label}
    >
      <header className="column-head">
        <span className="dot" aria-hidden="true" />
        <h2>{label}</h2>
        <span className="count">{cards.length}</span>
      </header>

      <div className="column-list" ref={listRef}>
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            isDragging={dragging?.id === card.id}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onOpen={onOpen}
            onMove={onMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {cards.length === 0 && <p className="empty">Nothing here.</p>}
      </div>
    </section>
  )
}
