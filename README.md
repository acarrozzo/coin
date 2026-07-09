# 🏰 Coin & Castle

A data-driven idle game — a ground-up rebuild of the original *Coin & Castle*.

- **Stack:** Svelte 5 (runes) + TypeScript + Vite
- **Architecture:** one serializable game-state object, one deterministic tick,
  all content defined as typed data. See [PLAN.md](PLAN.md) for the full
  design and roadmap.

## Getting started

```bash
npm install
npm run dev        # start the dev server
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check (svelte-check + tsc) |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |

## Project structure

```
src/
├── engine/    # game-agnostic simulation core (state, tick, actions, save, numbers)
├── content/   # the game as typed data (resources, buildings, recipes, units…)
├── systems/   # generic interpreters over content + state
├── ui/        # Svelte components — a pure projection of state
└── styles/    # design tokens (retro terminal theme, light + dark)
```
