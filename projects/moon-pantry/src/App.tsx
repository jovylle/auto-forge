import { useEffect, useMemo, useState } from 'react'
import { Moon } from './components/Moon'
import { MemphisBackdrop } from './components/MemphisBackdrop'
import { ALL_INGREDIENTS, BASICS, PHASES, RECIPES, type PhaseId } from './data'
import { useLocalStorage } from './hooks/useLocalStorage'

function fmtTime(d: Date) {
  let h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

function lateNight() {
  const h = new Date().getHours()
  return h >= 23 || h < 5
}

export default function App() {
  const [phase, setPhase] = useLocalStorage<PhaseId>('moon-pantry/phase', 'full')
  const [recipeId, setRecipeId] = useLocalStorage<string>('moon-pantry/recipe', 'full-frittata')
  const [pantryRaw, setPantry] = useLocalStorage<string[]>('moon-pantry/pantry', [])
  const [midnight, setMidnight] = useLocalStorage<boolean>('moon-pantry/midnight', lateNight())
  const pantry = Array.isArray(pantryRaw) ? pantryRaw.filter((x) => typeof x === 'string') : []

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('midnight', midnight)
    return () => root.classList.remove('midnight')
  }, [midnight])
  const [cooked, setCooked] = useLocalStorage<number>('moon-pantry/cooked', 0)
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(''), 2200)
    return () => window.clearTimeout(t)
  }, [flash])

  const validPhases = new Set(PHASES.map((p) => p.id))
  const safePhase: PhaseId = validPhases.has(phase) ? phase : 'full'
  const phaseMeta = PHASES.find((p) => p.id === safePhase) ?? PHASES[4]

  const phaseRecipes = useMemo(() => {
    const list = RECIPES.filter((r) => r.phase === safePhase)
    if (!midnight) return list
    return [...list].sort((a, b) => Number(b.midnight) - Number(a.midnight))
  }, [safePhase, midnight])

  const active = phaseRecipes.find((r) => r.id === recipeId) ?? phaseRecipes[0]

  useEffect(() => {
    setStep(0)
  }, [active.id])

  const pantrySet = useMemo(() => new Set(pantry), [pantry])
  const have = active.ingredients.filter((i) => pantrySet.has(i))
  const missing = active.ingredients.filter((i) => !pantrySet.has(i))
  const pct = Math.round((have.length / active.ingredients.length) * 100)

  const pantryList = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_INGREDIENTS
    return ALL_INGREDIENTS.filter((i) => i.toLowerCase().includes(q))
  }, [query])

  function toggleIngredient(name: string) {
    setPantry((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))
  }

  function stockAll() {
    setPantry((prev) => Array.from(new Set([...prev, ...active.ingredients])))
    setFlash('Pantry restocked for this recipe.')
  }

  function stockBasics() {
    setPantry((prev) => Array.from(new Set([...prev, ...BASICS])))
    setFlash('Kitchen basics are in.')
  }

  function handleCook() {
    setCooked((c) => c + 1)
    setFlash(midnight ? 'Plated at midnight. The moon approves.' : 'Plated. The moon approves.')
  }

  return (
    <>
      <MemphisBackdrop midnight={midnight} />

      <div className={`shell ${midnight ? 'midnight' : ''}`}>
        <header className="masthead">
          <div className="brand">
            <span className="brand__moon">
              <Moon phase={phase} size={56} />
            </span>
            <div className="brand__text">
              <h1 className="display brand__title">Moon Pantry</h1>
              <p className="mono brand__tag">a lunar recipe box for midnight cooks</p>
            </div>
          </div>

          <div className="tools">
            <div className="clock" aria-label="Current time">
              <span className="mono clock__time">{fmtTime(now)}</span>
              <span className="clock__label">{midnight ? 'midnight menu' : 'day kitchen'}</span>
            </div>
            <button
              className="mem-btn midnight-btn"
              aria-pressed={midnight}
              onClick={() => setMidnight((m) => !m)}
            >
              <Moon phase={midnight ? 'new' : 'full'} size={22} />
              {midnight ? 'Midnight ON' : 'Midnight mode'}
            </button>
          </div>
        </header>

        <div className="ticker" aria-hidden="true">
          <div className="ticker__track head">
            <span>★ cook by the moon</span><span>★ stock your pantry</span><span>★ midnight menu</span>
            <span>★ recipe phases</span><span>★ no images, just sauce</span>
            <span>★ cook by the moon</span><span>★ stock your pantry</span><span>★ midnight menu</span>
            <span>★ recipe phases</span><span>★ no images, just sauce</span>
          </div>
        </div>

        <main className="layout">
          <section className="rail mem-card tilt-l" aria-label="Lunar phases">
            <h2 className="head panel-title uwavy">Lunar Phases</h2>
            <div className="rail__list">
              {PHASES.map((p) => {
                const isOn = p.id === phase
                return (
                  <button
                    key={p.id}
                    className={`phase-btn ${isOn ? 'is-active' : ''}`}
                    aria-pressed={isOn}
                    onClick={() => setPhase(p.id)}
                  >
                    <Moon phase={p.id} size={30} />
                    <span className="phase-btn__name">{p.name}</span>
                    <span className="phase-btn__count mono">
                      {RECIPES.filter((r) => r.phase === p.id).length}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="stage">
            <div className="stage__head">
              <span className="sticker">{phaseMeta.short}</span>
              <p className="stage__blurb">{phaseMeta.blurb}</p>
            </div>

            <div className="tabs" role="tablist" aria-label="Recipes for this phase">
              {phaseRecipes.map((r) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={r.id === active.id}
                  className={`tab ${r.id === active.id ? 'is-active' : ''}`}
                  onClick={() => setRecipeId(r.id)}
                >
                  {r.midnight && <span className="tab__moon" aria-label="Midnight menu">☾</span>}
                  {r.name}
                </button>
              ))}
            </div>

            <article className={`recipe mem-card acc-${active.accent}`}>
              <div className="recipe__top">
                <div className="recipe__intro">
                  <span className={`sticker ${active.midnight ? 'sticker--night' : 'sticker--acc'}`}>
                    {active.midnight ? 'Midnight Menu' : 'Phase Recipe'}
                  </span>
                  <h2 className="head recipe__name">{active.name}</h2>
                  <p className="recipe__blurb">{active.blurb}</p>
                  <div className="recipe__meta">
                    <span className="meta-pill mono">{active.minutes} min</span>
                    <span className="meta-pill mono">serves {active.serves}</span>
                    <span className="meta-pill mono">{active.ritual.length} phases</span>
                  </div>
                </div>
                <div className="recipe__moon">
                  <Moon phase={active.phase} size={86} />
                </div>
              </div>

              <div className="cookability">
                <div className="cookability__row">
                  <span className="head">Cookability</span>
                  <span className="mono">{pct}%</span>
                </div>
                <div
                  className="meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label="Ingredients already in your pantry"
                >
                  <i style={{ width: `${pct}%` }} />
                </div>
                <p className="cookability__hint mono">
                  {pct === 100
                    ? 'Everything is in stock. Cook it.'
                    : `${missing.length} ingredient${missing.length === 1 ? '' : 's'} missing`}
                </p>
              </div>

              <div className="recipe__cols">
                <div className="ingredients">
                  <h3 className="head col-title">Ingredients</h3>
                  <ul className="ing-list">
                    {active.ingredients.map((i) => {
                      const has = pantrySet.has(i)
                      return (
                        <li key={i}>
                          <button
                            className={`ing ${has ? 'ing--have' : ''}`}
                            aria-pressed={has}
                            onClick={() => toggleIngredient(i)}
                          >
                            <span className="ing__box">{has ? '✓' : ''}</span>
                            <span className="ing__name">{i}</span>
                            <span className="ing__tag mono">{has ? 'in pantry' : 'missing'}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {missing.length > 0 && (
                    <button className="mem-btn mem-btn--ghost mem-btn--wide" onClick={stockAll}>
                      Stock all {active.ingredients.length}
                    </button>
                  )}
                </div>

                <div className="ritual">
                  <h3 className="head col-title">Ritual Phases</h3>
                  <ol className="ritual__list">
                    {active.ritual.map((r, idx) => (
                      <li
                        key={r}
                        className={idx === step ? 'is-now' : idx < step ? 'is-done' : ''}
                      >
                        <span className="ritual__num mono">{idx + 1}</span>
                        <span className="ritual__label head">{r}</span>
                        {idx === step && <span className="ritual__now mono">now</span>}
                      </li>
                    ))}
                  </ol>
                  <div className="ritual__controls">
                    <button
                      className="mem-btn mem-btn--tiny"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Back
                    </button>
                    <button
                      className="mem-btn mem-btn--tiny mem-btn--acc"
                      disabled={step === active.ritual.length - 1}
                      onClick={() => setStep((s) => Math.min(active.ritual.length - 1, s + 1))}
                    >
                      Next phase
                    </button>
                  </div>
                  <button className="mem-btn mem-btn--cook mem-btn--wide" onClick={handleCook}>
                    ☾ I cooked this
                  </button>
                </div>
              </div>
            </article>
          </section>

          <aside className="pantry mem-card tilt-r" aria-label="Pantry stock">
            <h2 className="head panel-title uwavy">Pantry Stock</h2>
            <p className="pantry__count mono">
              {pantry.length} / {ALL_INGREDIENTS.length} in stock
            </p>
            <input
              className="pantry__search"
              type="search"
              placeholder="Search ingredients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search ingredients"
            />
            <div className="pantry__actions">
              <button className="mem-btn mem-btn--tiny" onClick={stockBasics}>
                Stock basics
              </button>
              <button
                className="mem-btn mem-btn--tiny"
                onClick={() => {
                  setPantry([])
                  setFlash('Pantry emptied. New moon energy.')
                }}
              >
                Clear
              </button>
            </div>
            <ul className="pantry__list">
              {pantryList.map((i) => {
                const has = pantrySet.has(i)
                return (
                  <li key={i}>
                    <button
                      className={`chip ${has ? 'chip--on' : ''}`}
                      aria-pressed={has}
                      onClick={() => toggleIngredient(i)}
                    >
                      <span className="chip__dot" aria-hidden="true" />
                      {i}
                    </button>
                  </li>
                )
              })}
              {pantryList.length === 0 && (
                <li className="pantry__empty mono">No ingredient matches “{query}”.</li>
              )}
            </ul>
          </aside>
        </main>

        <footer className="foot mono">
          <span>☾ Moon Pantry</span>
          <span>{cooked} plate{cooked === 1 ? '' : 's'} cooked</span>
          <span>no images · css + canvas only</span>
        </footer>
      </div>

      {flash && (
        <div className="toast head" role="status">
          {flash}
        </div>
      )}
    </>
  )
}
