import type { DrawerItem } from '../types'
import LedgerRow from './LedgerRow'
import AddEntryForm from './AddEntryForm'
import EmptyBasket from './EmptyBasket'

interface Props {
  items: DrawerItem[]
  departing: DrawerItem[]
  hasAny: boolean
  query: string
  foundId: string | null
  justAdded: string | null
  onAdd: (name: string, note: string, category: string) => void
  onRemove: (id: string, x: number, y: number) => void
}

export default function LedgerSheet({
  items,
  departing,
  hasAny,
  query,
  foundId,
  justAdded,
  onAdd,
  onRemove,
}: Props) {
  const q = query.trim().toLowerCase()
  const isSearching = q.length > 0
  const showDeparting = departing.length > 0
  const showEmpty = !hasAny && !showDeparting
  const showNoResults = hasAny && items.length === 0 && !showDeparting

  return (
    <section className="ledger-col" aria-label="Drawer log">
      <div className="ledger-sheet">
        <span className="tape tape-tl" aria-hidden="true" />
        <span className="tape tape-tr" aria-hidden="true" />
        <div className="ledger-head">
          <h2 className="ledger-heading">The Drawer Ledger</h2>
          <p className="ledger-motto">every thing, one line</p>
        </div>

        <div className="ledger-rules" role="table" aria-label="Drawer log entries">
          <div className="ledger-hdr" role="row">
            <span role="columnheader">№</span>
            <span role="columnheader">thing</span>
            <span className="h-note" role="columnheader">
              note
            </span>
            <span className="h-cat" role="columnheader">
              sort
            </span>
            <span className="h-act" role="columnheader">
              let go
            </span>
          </div>

          {items.length > 0 && (
            <ul className="ledger-body" role="rowgroup">
              {items.map((item) => {
                const matched =
                  isSearching &&
                  (item.name.toLowerCase().includes(q) || item.note.toLowerCase().includes(q))
                const dimmed = isSearching && !matched
                const found = foundId === item.id
                return (
                  <LedgerRow
                    key={item.id}
                    item={item}
                    matched={matched}
                    dimmed={dimmed}
                    found={found}
                    fresh={justAdded === item.id}
                    onRemove={onRemove}
                  />
                )
              })}
            </ul>
          )}

          {showDeparting && (
            <ul className="ledger-body departing-block" role="rowgroup" aria-label="Recently released">
              {departing.map((item) => (
                <LedgerRow
                  key={item.id}
                  item={item}
                  departing
                  matched={false}
                  dimmed={false}
                  found={false}
                  fresh={false}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          )}
        </div>

        {showNoResults && (
          <p className="ledger-empty-search" role="status">
            {isSearching
              ? 'nothing in the drawer answers to that name'
              : 'nothing filed under this sort yet'}
          </p>
        )}

        {showEmpty && <EmptyBasket />}

        <AddEntryForm onAdd={onAdd} />
      </div>
    </section>
  )
}