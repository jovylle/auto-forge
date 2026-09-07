import type { Item } from '../lib/items'
import { RARITY, itemName, typeOf } from '../lib/items'

interface TooltipProps {
  item: Item
  x: number
  y: number
}

export function Tooltip({ item, x, y }: TooltipProps) {
  const type = typeOf(item)
  const rarity = RARITY[item.rarity]
  const left = Math.min(x + 18, window.innerWidth - 236)
  const top = Math.min(y + 18, window.innerHeight - 160)
  return (
    <div className="tooltip" role="tooltip" style={{ left, top }}>
      <div className="tooltip-head">
        <span className="tooltip-emoji" aria-hidden="true">
          {type.emoji}
        </span>
        <div>
          <div className="tooltip-name">{itemName(item)}</div>
          <div className="tooltip-rarity" style={{ color: rarity.color }}>
            {rarity.label} · Lv {item.level}
          </div>
        </div>
      </div>
      <div className="tooltip-stat">{type.stat}</div>
      <div className="tooltip-blurb">{type.blurb}</div>
      <div className="tooltip-value" style={{ color: rarity.color }}>
        {item.value} gp
      </div>
    </div>
  )
}