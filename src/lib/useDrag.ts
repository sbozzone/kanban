import { useCallback, useRef, useState } from 'react'
import type { Status, Task } from './types'

export interface DropTarget {
  status: Status
  index: number
}

interface Dragging {
  task: Task
  x: number
  y: number
}

/** Movement needed before a press becomes a drag, so a tap stays a tap. */
const THRESHOLD = 6

/**
 * Drag and drop built on Pointer Events rather than HTML5 drag, which never
 * fires on iOS Safari or Android Chrome — the devices most likely to be
 * holding this board.
 */
export function useDrag(onDrop: (taskId: string, status: Status, index: number) => void) {
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const start = useRef<{ x: number; y: number; task: Task; active: boolean } | null>(null)

  /** Which column, and which slot within it, sits under the pointer. */
  const hitTest = useCallback((x: number, y: number, movingId: string): DropTarget | null => {
    const column = document.elementFromPoint(x, y)?.closest('[data-column]')
    if (!(column instanceof HTMLElement)) return null

    const status = column.dataset.column as Status
    const cards = Array.from(column.querySelectorAll<HTMLElement>('[data-task-id]')).filter(
      (card) => card.dataset.taskId !== movingId,
    )

    for (let i = 0; i < cards.length; i += 1) {
      const box = cards[i].getBoundingClientRect()
      if (y < box.top + box.height / 2) return { status, index: i }
    }
    return { status, index: cards.length }
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent, task: Task) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    start.current = { x: event.clientX, y: event.clientY, task, active: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const from = start.current
      if (!from) return

      if (!from.active) {
        const travelled = Math.hypot(event.clientX - from.x, event.clientY - from.y)
        if (travelled < THRESHOLD) return
        from.active = true
      }

      event.preventDefault()
      setDragging({ task: from.task, x: event.clientX, y: event.clientY })
      setTarget(hitTest(event.clientX, event.clientY, from.task.id))
    },
    [hitTest],
  )

  const finish = useCallback(
    (event: React.PointerEvent) => {
      const from = start.current
      start.current = null
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (from?.active && target) onDrop(from.task.id, target.status, target.index)
      setDragging(null)
      setTarget(null)
    },
    [onDrop, target],
  )

  return {
    dragging,
    target,
    handleProps: (task: Task) => ({
      onPointerDown: (event: React.PointerEvent) => onPointerDown(event, task),
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    }),
  }
}
