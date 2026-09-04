const KEYS: [string, string][] = [
  ['SPACE', 'start / pause breath'],
  ['ESC', 'pause · close'],
  ['← →', 'shift phase'],
  ['?', 'help'],
  ['R', 'wipe wall'],
]

export function HelpStrip() {
  return (
    <div className="help-strip" aria-hidden="true">
      {KEYS.map(([key, label]) => (
        <span className="keycap-row" key={key}>
          <kbd className="keycap">{key}</kbd>
          <span className="keycap-label">{label}</span>
        </span>
      ))}
    </div>
  )
}