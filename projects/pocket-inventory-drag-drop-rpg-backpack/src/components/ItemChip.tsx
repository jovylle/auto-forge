import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { Item } from '../lib/items'
import { RARITY } from '../lib/items'

interface ChipProps {
  item: Item
  label: string
  className?: string
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onClick?: () => void
  onKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void
  onMouseEnter?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseMove?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
}

export function ItemChip({ item, label, className, onPointerDown, onClick, onKeyDown, onMouseEnter, onMouseMove, onMouseLeave }: ChipProps) {
  const color = RARITY[item.rarity].color
  return (
    <button
      type="button"
      className={`chip r-${item.rarity}${className ? ` ${className}` : ''}`}
      style={{ '--rar': color } as CSSProperties}
      aria-label={label}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="chip-emoji" aria-hidden="true">
        {itemEmoji(item.typeId)}
      </span>
    </button>
  )
}

export function itemEmoji(typeId: string): string {
  const map: Record<string, string> = {
    potion: '🧪',
    blade: '⚔️',
    shield: '🛡️',
    gem: '💎',
    scroll: '📜',
    rations: '🍖',
    shroom: '🍄',
    key: '🗝️',
    bomb: '💣',
    orb: '🔮',
    charm: '🧿',
    coral: '🪸',
  }
  return map[typeId] ?? '❓'
}