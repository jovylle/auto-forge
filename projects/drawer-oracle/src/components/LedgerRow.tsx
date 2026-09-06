import { memo } from 'react'
import type { MouseEvent } from 'react'
import type { DrawerItem } from '../types'

interface Props {
  item: DrawerItem
  matched?: boolean
  dimmed?: boolean
  found?: boolean
  departing?: boolean
  fresh?: boolean
  onRemove?: (id: string, x: number, y: number) => void
}

function LedgerRow({
  item,
  matched = false,
  dimmed = false,
  found = false,
  departing = false,
  fresh = false,
  onRemove,
}: Props) {
  const classes = [
    'ledger-row',
    departing ? 'is-departing' : '',
    matched ? 'is-matched' : '',
    dimmed ? 'is-dimmed' : '',
    found ? 'is-found' : '',
    fresh ? 'is-fresh' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!onRemove) return
    const r = e.currentTarget.getBoundingClientRect()
    onRemove(item.id, r.left + r.width / 2, r.top + r.height / 2)
  }

  return (
    <li className={classes} role="row">
      <span className="row-no" role="cell">
        № {item.no}
      </span>
      <span className="row-name" role="cell" title={item.name}>
        {item.name}
      </span>
      <span className="row-note" role="cell" title={item.note}>
        {item.note || '—'}
      </span>
      <span className="row-cat" role="cell">
        <span className="cat-stamp">{item.category}</span>
      </span>
      <span className="row-act" role="cell">
        {!departing && onRemove && (
          <button
            type="button"
            className="release-btn"
            onClick={handleRemove}
            aria-label={`Release ${item.name} from the drawer`}
            title="let this thing go"
          >
            ✂
          </button>
        )}
      </span>
      {found && (
        <span className="found-stamp" aria-hidden="true">
          FOUND IT
        </span>
      )}
      {departing && (
        <span className="gone-stamp" aria-hidden="true">
          GONE
        </span>
      )}
    </li>
  )
}

export default memo(LedgerRow)