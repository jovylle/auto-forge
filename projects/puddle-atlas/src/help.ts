function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

export class HelpView {
  private overlay: HTMLElement
  private closeBtn: HTMLButtonElement

  constructor(overlay: HTMLElement) {
    this.overlay = overlay
    const card = el('div', 'help-card')

    const title = el('div', 'masthead-line', 'FIELD')
    title.style.fontSize = '1.75rem'
    title.style.lineHeight = '1'
    const title2 = el('div', 'masthead-line', 'MANUAL')
    title2.style.fontSize = '1.75rem'
    title2.style.lineHeight = '1'
    const note = el('div', 'micro-label', 'STATION 12 · PUDDLE SURVEY PROTOCOL')
    note.style.marginTop = '0.4rem'

    const keys = el('div', 'help-keys')
    const rows: Array<[string[], string, boolean]> = [
      [['↑', '↓', '←', '→'], 'MOVE SURVEYOR', false],
      [['⏎'], 'LOG PUDDLE', false],
      [['S'], 'BRUSH SIZE S / M / L', false],
      [['R'], 'TOGGLE RAIN', false],
      [['⌫'], 'REMOVE PUDDLE', false],
      [['H', '?'], 'THIS MANUAL', false],
    ]
    for (const [glyphs, desc] of rows) {
      const row = el('div', 'key-row')
      for (const g of glyphs) row.appendChild(el('span', 'key', g))
      row.appendChild(el('span', 'key-desc', desc))
      keys.appendChild(row)
    }

    const foot = el('div', 'help-foot')
    this.closeBtn = el('button', 'help-close', 'Close') as HTMLButtonElement
    this.closeBtn.setAttribute('type', 'button')
    const footNote = el('span', 'micro-label', 'LOCAL ONLY — SAVED IN YOUR BROWSER')
    foot.append(this.closeBtn, footNote)

    card.append(title, title2, note, keys, foot)
    this.overlay.appendChild(card)

    this.closeBtn.addEventListener('click', () => this.close())
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
  }

  get isOpen(): boolean {
    return !this.overlay.classList.contains('hidden')
  }

  open(): void {
    this.overlay.classList.remove('hidden')
    this.closeBtn.focus()
  }

  close(): void {
    this.overlay.classList.add('hidden')
    const plate = document.querySelector('.map-plate') as HTMLElement | null
    plate?.focus()
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault()
      this.close()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      this.closeBtn.focus()
    }
  }
}