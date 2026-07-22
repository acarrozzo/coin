# Coin & Castle

A data-driven idle/settlement game. Build a settlement from a shack to a kingdom
by gathering resources, staffing production lines, crafting up a tech chain, and
defending against escalating threats. Svelte 5 (runes) + TypeScript + Vite.

The original game — a monolithic prototype — lives at
[`../old-FOR REFERENCE ONLY/coin-old/`](../old-FOR%20REFERENCE%20ONLY/coin-old/)
and is the **design spec**: mechanics, numbers, and progression are ported from
it. It is reference only — never import from or edit it.

## Commands

```bash
npm run dev        # Vite dev server (HMR)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run check      # svelte-check + tsc — run this after any type/content change
npm run test       # Vitest once (tests/*.test.ts)
npm run test:watch # Vitest watch
npm run lint       # ESLint
npm run format     # Prettier write
```

Always run `npm run check` and `npm run test` before considering a change done.

## The five rules this codebase is built on

1. **One serializable state object.** All game state is a single `GameState`
   ([src/engine/state.ts](src/engine/state.ts)). No globals, no state in the DOM.
   Save = serialize it; load = deserialize it.
2. **One deterministic tick.** [`tick(state, dt)`](src/engine/tick.ts) is the
   *only* thing that advances the simulation — the live loop, offline catch-up,
   and tests all go through it. Given the same state + dt it always produces the
   same result (no `Math.random`, no wall-clock reads inside systems).
3. **Content is data.** Resources, buildings, settlement tiers, producers, and
   combat are typed data in [src/content/](src/content/). **Adding a
   resource / building / recipe / unit is a data edit, not new code** — generic
   systems interpret the data. Reach for a new function only when a mechanic
   genuinely doesn't fit the existing shapes.
4. **Mutations go through actions/systems.** State changes funnel through the
   functions in [src/engine/actions.ts](src/engine/actions.ts) and
   [src/systems/](src/systems/). UI and the loop call these; they never poke
   `state` directly. This is the seam a future server-authority layer plugs into.
5. **UI is a pure projection of state.** Svelte components read derived values
   from [selectors](src/engine/selectors.ts) and call actions. Game logic never
   touches the DOM.

## Layout — where things live

```
src/
├── engine/      # game-agnostic core
│   ├── state.ts       GameState type + createInitialState(); SAVE_VERSION
│   ├── tick.ts        tick(state, dt, opts) — the single step
│   ├── actions.ts     player mutations: assignWorker, trainWorker, forage,
│   │                  chopWood, mineStone, buyTool, buyExtraWorker
│   ├── selectors.ts   ALL derived reads: capacities, rates, affordability,
│   │                  worker counts, unlocks, combat forecasts
│   ├── offline.ts      catch-up simulation (steps tick with combat OFF)
│   ├── save.ts         serialize / deserialize / versioned migrations
│   └── numbers.ts      Decimal (break_infinity.js) + formatting
├── content/     # THE GAME, as typed data
│   ├── resources.ts    every material; ResourceId union; categories
│   ├── buildings.ts     9 buildings, per-level cost/effects (Farm is generated)
│   ├── settlement.ts    10 tiers (Small Shack → Kingdom): costs, caps, gates
│   ├── producers.ts     every production line (gathering + crafting unified)
│   └── combat.ts        the two threat tracks (assault, hex)
├── systems/     # generic interpreters over content + state
│   ├── production.ts    runs all producer lines each tick
│   ├── combat.ts        resolves assaults/hexes
│   ├── buildings.ts     build/upgrade a building
│   └── settlement.ts    upgrade to the next tier
├── ui/          # Svelte 5 components + reactive glue
│   ├── gameStore.svelte.ts   the runtime: rAF loop, autosave, offline, pops
│   ├── *.svelte              panels (Resource, Settlement, Camp, Combat, Shop…)
│   ├── sections.ts           nav/section definitions shared by App + panels
│   └── *.svelte.ts           theme, sound, notify, format helpers
└── styles/      # design tokens + themes (retro terminal look, light+dark)
```

Tests live in [tests/](tests/): `engine`, `combat`, `ui`, `integration`, `smoke`.

## How it runs (the loop)

[gameStore.svelte.ts](src/ui/gameStore.svelte.ts) owns a single Svelte 5 `$state`
`GameState` and drives it:

- A `requestAnimationFrame` accumulator calls `tick` at a **fixed 0.1s step**
  (10 ticks/s). Combat resolves only in this live loop.
- **Autosave** every 30s, plus on tab-hide and `beforeunload`.
- On load / tab-return, [`applyOffline`](src/engine/offline.ts) fast-forwards the
  gap (capped at **8h**) by stepping `tick` with **combat disabled**, then shows a
  "Welcome back" summary if the player was away ≥60s.
- Per-cycle output is surfaced as floating "+X" pops; combat outcomes and
  build/level events as toasts.

## Mechanics you need to know before touching systems

- **Atomic production cycles.** A producer does *not* trickle output. It
  accumulates time toward one `cycleSeconds` cycle and emits a whole
  `workers × outputPerCycle` at completion. The input/capacity gate
  ([`canStartCycle`](src/engine/selectors.ts)) is checked **only at cycle
  start**. Once committed, a cycle completes even if inputs are spent elsewhere —
  and that input deduction **is allowed to drive a resource negative** (never
  clamped; it recovers as upstream lines refill). This is deliberate — don't
  "fix" it by clamping.
- **Integer vs fractional resources.** Most resources stay on whole integers
  because their lines emit ≥1 per cycle. The exceptions are derived, not
  hand-listed: any producer with `outputPerCycle < 1` (metals iron→adamantium,
  coin) is fractional. See `isFractionalResource` / `resourceDecimals` in
  [producers.ts](src/content/producers.ts).
- **Workers** are one shared pool: `trained` (grown via food on a
  `floor(n²/2)` cost curve) + `bonus` (bought with arrows in the Shop), minus
  what's `assigned` per line. A line's max staff comes from its `workerCap`:
  `'pool'` (whole pool), `'level'` (gating structure's level), or a fixed number
  (single-slot converters like defense/ward/quests use `1`).
- **Caps.** wood/stone/food caps come from the current settlement tier;
  defense/ward/coin caps come from the Castle / Wizard Tower / Bank level
  (`getCapacity`). Uncapped resources return `null`.
- **Cost vs requirement.** A cost entry is *spent* only if its resource is a
  consumable category (currently just `base`: wood/stone/food + the few
  consumable quest items). Everything else in a cost (metals, units, etc.) is a
  **standing requirement** — you must hold it, but it isn't deducted. See
  `splitCost` / `isConsumableResource`. Settlement tiers also have a separate
  `requires` block (e.g. `defense ≥ 5`) that is checked but never consumed.
- **Progression spine** is the settlement `level` (1–10). It gates which
  buildings are available, which building levels can be built (`requiresLevel`),
  which producers unlock (`minLevel`), and when combat begins.
- **Combat is deterministic and defense-based.** Two tracks in
  [combat.ts](src/content/combat.ts): **assaults** (repelled by the `defense`
  stat, rewards `honor`) and **hexes** (repelled by `ward`, rewards `wisdom`).
  `attackPower = basePower × growth^wave`. Meet it → repelled, +1 reward, wave
  escalates. Fall short → lose `lossAmount` of the stat (core resources looted if
  it hits 0) and the attacker **resets to wave 0**. Defense/ward are capped by
  building level, so waves eventually outgrow your walls until you upgrade.

## Saves & migrations

State is JSON in `localStorage` under `cc:save` (Decimals → strings).
`SAVE_VERSION` is in [state.ts](src/engine/state.ts); [save.ts](src/engine/save.ts)
holds an ordered `migrations` map where entry *N* upgrades a version-*N* save to
*N+1*. **When you change the save shape, bump `SAVE_VERSION` and add a migration**
so existing players' saves don't break. Deserialize also falls back to fresh
defaults for any missing/invalid field, so adding new content is safe without a
migration. Transient runtime state (per-line cycle `progress`) is intentionally
*not* persisted.

## Conventions

- **Numbers are `Decimal`** (break_infinity.js) everywhere a game quantity is
  stored or math'd. Wrap inputs with `D(...)`; format for display with
  `formatNumber` / the rate helpers in [numbers.ts](src/engine/numbers.ts). Don't
  use raw JS numbers for resource amounts.
- **Svelte 5 runes only** (`$state`, `$derived`, `$props`, `$effect`). `.svelte.ts`
  files carry rune-based reactive logic outside components.
- **Derived reads belong in [selectors.ts](src/engine/selectors.ts)**, not
  inlined in components — keeps the UI a thin projection and the logic testable.
- **Icons** come from `@lucide/svelte` (per-icon imports).
- TypeScript is strict; content records are keyed by their id unions, so adding
  an id to a union forces you to fill in every table — lean on that.


## Working approach

- Read the relevant implementation before proposing changes.
- Make the smallest change that solves the task.
- Reuse established patterns from nearby files.
- Do not refactor unrelated code.
- Run the narrowest relevant validation first.
- Summarize changed files and any remaining risks.

- Do not scan the whole repository unless necessary.
- Do not read generated files, lockfiles, or build output unless directly relevant.
- Prefer targeted searches over broad directory listings.
- Keep explanations concise unless asked for detail.
- Do not repeat the task or narrate routine tool usage.
