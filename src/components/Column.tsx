import { TaskCard } from './TaskCard'
import type { DropTarget } from '../lib/useDrag'
import type { ColumnSpec, Task } from '../lib/types'

interface Props {
  spec: ColumnSpec
  tasks: Task[]
  total: number
  collapsed: boolean
  onToggleCollapsed: (status: ColumnSpec['status']) => void
  draggingId: string | null
  target: DropTarget | null
  handleProps: (task: Task) => Record<string, unknown>
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
  onNudge: (task: Task, direction: -1 | 1) => void
  onDelete: (task: Task) => void
  filtered: boolean
}

export function Column({
  spec,
  tasks,
  total,
  collapsed,
  onToggleCollapsed,
  draggingId,
  target,
  handleProps,
  onOpen,
  onToggleDone,
  onNudge,
  onDelete,
  filtered,
}: Props) {
  const over = spec.wip !== null && total > spec.wip
  const dropping = target?.status === spec.status
  const others = tasks.filter((task) => task.id !== draggingId).length

  // The dragged card stays mounted: it holds the pointer capture, and
  // unmounting it would cut off the very events that finish the drag.
  let slot = 0

  return (
    <section
      className={`column column-${spec.status}${collapsed ? ' column-collapsed' : ''}${
        dropping ? ' column-dropping' : ''
      }`}
      data-column={spec.status}
      aria-label={spec.label}
    >
      <header className="column-head">
        <button
          className="collapse"
          type="button"
          onClick={() => onToggleCollapsed(spec.status)}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${spec.label}`}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <h2>{spec.label}</h2>
        <span className={`count${over ? ' count-over' : ''}`}>
          {spec.wip === null ? total : `${total} / ${spec.wip}`}
        </span>
      </header>

      {over && !collapsed && (
        <p className="wip-warning" role="status">
          Over the {spec.wip} you set for this column. Nothing is blocked — worth a look.
        </p>
      )}

      {!collapsed && (
        <div className="column-list">
          {tasks.map((task, index) => {
            const moving = task.id === draggingId
            const at = slot
            if (!moving) slot += 1
            return (
              <div key={task.id} className="slot">
                {dropping && !moving && target?.index === at && <div className="drop-line" />}
                <TaskCard
                  task={task}
                  isDragging={moving}
                  handleProps={handleProps(task)}
                  onOpen={onOpen}
                  onToggleDone={onToggleDone}
                  onNudge={onNudge}
                  onDelete={onDelete}
                  canMoveUp={!filtered && index > 0}
                  canMoveDown={!filtered && index < tasks.length - 1}
                />
              </div>
            )
          })}

          {dropping && (target?.index ?? 0) >= others && <div className="drop-line" />}

          {tasks.length === 0 && (
            <p className="empty">
              {filtered ? 'Nothing here matches the filters.' : emptyFor(spec.status)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function emptyFor(status: ColumnSpec['status']): string {
  if (status === 'backlog') return 'Nothing parked here.'
  if (status === 'todo') return 'Nothing queued up.'
  if (status === 'progress') return 'Nothing on the go.'
  return 'Nothing finished yet.'
}
