You are an autonomous builder. Build ONE polished single-file-ish web experiment in the CURRENT directory.

Memory: re-read SPEC.md if you lose context.

## Project
Name: {{NAME}}
Category: {{CATEGORY}} | Stack: HTML/CSS/JS (no build) | Aesthetic: {{AESTHETIC}}

## SPEC
{{SPEC}}

## Features (all required)
{{FEATURES}}

{{RETRY_CONTEXT}}

## Stack
- Plain HTML + CSS + JS (ES modules allowed). No bundler. No npm.
- Files: index.html, style.css, app.js (you may add more if needed, but keep it simple)
- No backend, no API keys. localStorage for persistence if needed.
- Keep it fast, self-contained, works from file:// and from a static host.

## Design mandate
- Strong visual identity. No default gray/white corporate look.
- Aesthetic: {{AESTHETIC}} — express it through palette, typography (Google Fonts @import is fine), layout, animations.
- Must feel crafted, not templatey. Micro-interactions and polish matter.

## Build steps
1. Design in your head: palette, type, layout, interactions.
2. Implement index.html + style.css + app.js to fulfill all SPEC features.
3. Smoke-check: open index.html in mind — no broken refs, no console errors, works at 375px width.
4. Write README.md (how to open, what it does).

## Final step
Write .factory/result.json: {"status":"pass"|"fail","summary":"...","buildPassed":true,"featuresImplemented":[...]}

Keep it tight. Ship one beautiful thing.
