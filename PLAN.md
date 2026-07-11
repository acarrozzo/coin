# Coin & Castle — Rebuild Plan

A ground-up rebuild of the idle game as a **data-driven simulation** on a modern
stack. The original monolith (`coin-old` / `coin-og`) is the **design spec** — we
re-implement its known-good mechanics on a foundation that can actually carry
battle, prestige, and future content. The ECS folder (`coin/`) is set aside.

**Decisions locked in:**
- Framework: **Svelte 5 (runes) + TypeScript + Vite**
- First milestone: **thin vertical slice** (complete end-to-end, tiny content)
- Persistence: **client-only now, backend-ready by design** (add cloud later)
- Platform: **responsive desktop + mobile**, PWA-ready

---

## 1. Guiding principles

1. **One serializable state object.** All game state lives in a single typed
   object. No globals, no state living in the DOM. Save = serialize it; load =
   deserialize it.
2. **One deterministic tick.** A single fixed-timestep loop advances the whole
   simulation. This makes offline progress, testing, and balancing trivial.
3. **Content is data, not code.** Resources, buildings, recipes, units, enemies,
   and prestige upgrades are typed data entries interpreted by a few generic
   systems. Adding content = adding data. Rare special cases use script hooks.
4. **UI is a pure projection of state.** Svelte reactivity renders from the store;
   game logic never touches the DOM directly.
5. **Big numbers from day one.** A `Decimal` type (break_infinity-style) so
   late-game multipliers never overflow.
6. **Actions are the only way to mutate state.** All changes funnel through a
   small set of typed action functions — the seam where a server-authority /
   anti-cheat layer plugs in later.

---

## 2. Tech stack & tooling

| Concern | Choice | Why |
|---|---|---|
| Framework | Svelte 5 (runes) | State-projection fit, small bundle, built-in transitions |
| Language | TypeScript (strict) | Type-safe content schemas + refactor safety |
| Build | Vite | Fast dev, easy PWA + static deploy |
| Big numbers | `break_infinity.js` (Decimal) | Genre-standard overflow safety |
| State | Plain TS object + Svelte stores/runes | Single source of truth |
| Styling | CSS with design tokens (keep the retro terminal look) | Port the VT323/Share Tech Mono aesthetic |
| Testing | Vitest | Pure tick/action functions are trivial to unit-test |
| Lint/format | ESLint + Prettier | Consistency from the start |
| Deploy | Static host (Netlify/Vercel/GH Pages) | No server needed yet |

---

## 3. Project structure

```
coin-castle/                 # new dir (sibling of coin/, coin-old/)
├── index.html
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── App.svelte
│   ├── engine/              # game-agnostic simulation core
│   │   ├── state.ts         # GameState type + factory (initial state)
│   │   ├── tick.ts          # tick(dt): advances the whole sim
│   │   ├── actions.ts       # typed mutations (assignWorker, build, prestige…)
│   │   ├── offline.ts       # catch-up simulation on load
│   │   ├── save.ts          # serialize / deserialize / versioned migration
│   │   ├── numbers.ts       # Decimal helpers + formatting (1.2K, 3.4M…)
│   │   └── selectors.ts     # derived values (net rates, canAfford, capacity)
│   ├── content/             # THE DATA — the whole game as typed config
│   │   ├── resources.ts
│   │   ├── buildings.ts
│   │   ├── recipes.ts
│   │   ├── units.ts
│   │   ├── enemies.ts
│   │   └── prestige.ts
│   ├── systems/             # generic interpreters over content + state
│   │   ├── production.ts
│   │   ├── crafting.ts
│   │   ├── buildings.ts
│   │   ├── combat.ts
│   │   └── prestige.ts
│   ├── ui/                  # Svelte components (projection only)
│   │   ├── stores.ts        # reactive wrapper around GameState
│   │   ├── ResourcePanel.svelte
│   │   ├── BuildingList.svelte
│   │   ├── WorkerControls.svelte
│   │   ├── CombatPanel.svelte
│   │   ├── PrestigePanel.svelte
│   │   └── juice/           # floating text, bars, transitions
│   └── styles/
│       └── tokens.css
└── tests/
```

---

## 4. Core architecture

### 4.1 State shape (illustrative)
```ts
type GameState = {
  version: number;                       // for save migrations
  lastTick: number;                      // epoch ms, for offline calc
  playtime: number;

  resources: Record<ResourceId, {
    amount: Decimal;
    // capacity is derived from buildings/level, not stored
  }>;
  workers: {
    total: number;
    assigned: Record<ResourceId, number>;
  };
  buildings: Record<BuildingId, { level: number; unlocked: boolean }>;
  military: Record<UnitId, number>;
  combat: { assaultWins: number; assaultLosses: number; /* … */ };
  prestige: { points: Decimal; upgrades: Record<UpgradeId, number>; resets: number };
  flags: Record<string, boolean>;        // unlocks, one-offs
};
```

### 4.2 The tick
```ts
function tick(state: GameState, dt: number): GameState {
  // pure-ish: production → crafting → buildings → combat timers → prestige
  // each system reads content + state, returns state deltas
  // dt is seconds; called at fixed step (e.g. 20/s) from a rAF accumulator
}
```
Single accumulator loop in the UI layer calls `tick` at a fixed step; rendering
reads the resulting state. **Offline progress** = on load, compute
`elapsed = now - state.lastTick`, then run `tick` in fast-forward (capped, e.g.
8–12h) and show a "Welcome back" summary.

### 4.3 Content as data (illustrative)
```ts
// resources.ts
export const RESOURCES = {
  wood:  { name: 'Wood',  baseCap: 50,  perWorker: 1 },
  stone: { name: 'Stone', baseCap: 50,  perWorker: 1, unlockLevel: 2 },
  // …
} satisfies Record<string, ResourceDef>;

// buildings.ts
export const BUILDINGS = {
  cabin: {
    name: 'Cabin',
    levels: [
      { cost: { wood: 3 },             effect: { setLevel: 2, unlock: ['stone'] } },
      { cost: { wood: 20, stone: 10 }, effect: { capMult: 1.5 } },
    ],
  },
  // …
} satisfies Record<string, BuildingDef>;
```
Generic systems interpret these. Adding "Blacksmith → sword" is a data entry, not
a new function. A `hook?: (state) => void` escape hatch covers the rare special
case.

### 4.4 Save/versioning
Serialize the state object to JSON (Decimals → strings) into `localStorage` under
a versioned key. A `migrations[]` array upgrades old saves on load so shipping
balance/content changes never bricks a player's progress.

---

## 5. Milestones

Each milestone ends **playable + committed + tested**. Estimates are rough
solo-pace guidance, not commitments.

### Phase 0 — Scaffold  *(0.5 day)*
- Vite + Svelte 5 + TS project, ESLint/Prettier/Vitest, deploy pipeline.
- Port the retro visual tokens (fonts, colors) into `tokens.css`.
- **Done when:** `npm run dev` shows a themed empty shell; CI/deploy works.

### Phase 1 — Thin vertical slice *(the architecture proof)*  *(2–3 days)*
The whole engine, proven with minimal content:
- `GameState`, `tick`, `actions`, Decimal numbers, selectors.
- Content: **2 resources (wood, stone)**, a shared **worker pool** with
  assign +/−, **one building (Cabin)** that unlocks stone.
- Production runs off the single tick; UI projects state; net-rate badges.
- **Save/load + offline progress + "welcome back"** working end to end.
- Vitest covers tick math, offline catch-up, save round-trip.
- **Done when:** you can play, close the tab, reopen, and correctly gain offline
  resources — and the whole thing is one state object + one tick.

### Phase 2 — Generalized economy engine + core production chain  *(done)*
Using `coin-old` as the spec, express the base game as content data:
- Generalized **producers** (gathering and crafting unified; crafting throttled
  by inputs), **settlement tiers** with absolute caps, dynamic capacities,
  **worker training** on the floor(n²/2) food curve.
- Content: resources (base, metals, weapons, goods), settlement tiers
  Shack→Village, buildings **Farm, Deep Mine, Blacksmith, Hunter's Cabin**,
  crafting recipes. Adding a resource/building/producer is a pure data edit.
- Save **v2** with a v1→v2 migration.
- **Scoping refinement:** the original's **military units, castle/wizard/shaman
  quest items, and combat-gated upper tiers** (defense/honor/wisdom) are
  inseparable from combat, so they move to **Phase 4** — where the Barracks,
  Castle, Wizard Tower, Cloud Shaman, and the Kingdom-tier climb are ported
  alongside the systems that give them meaning.

### Phase 3 — Polish & feel  *(2–4 days)*
- Responsive layout for desktop + mobile; touch targets; **PWA** (installable,
  offline-capable).
- Juice: floating "+N" text, animated bars, level-up flourishes, Svelte
  transitions, optional sound.
- Settings: theme toggle, save export/import, hard reset.
- **Done when:** it feels good to play on a phone and a desktop.

### Phase 4 — Battle (auto-battler) + combat-coupled content  *(done)*
- Ported the **Barracks** (archer/warrior/mage units) and **Wizard Tower**
  (ether/ward), plus the **combat-gated settlement tiers** Large Village → Town →
  City → **Kingdom**, deferred from Phase 2.
- **Deterministic power-vs-power combat:** two escalating threat tracks —
  **assaults** (army power vs threat → honor; casualties on defeat) and **hexes**
  (ward power vs threat → wisdom; wards consumed on defeat). Data-driven in
  `content/combat.ts`. Honor/wisdom gate the upper tiers, closing the loop.
- Combat runs live only (not during offline catch-up), with win/loss toasts and a
  Defense panel forecasting each attack (will hold / will fall).
- **Simplifications from the original** (candidates for later): the quest-item web
  (magic orb / soul gem / star metal / holy water) and Cloud Shaman / dream leaf
  were replaced by the cleaner honor/wisdom economy; unit-type **counters**
  (rock-paper-scissors) and a **wave/tower-defense** mode remain as future
  enhancements.
- **Done when:** combat is a real, escalating subsystem that drives progression.

### Phase 4.5 — Faithful port of the original coin-old content  *(done)*
Superseded the Phase 4 simplifications: the game now matches the original
coin-old mechanics closely while keeping the new engine (offline, save
versioning, data-driven content, the finished 51-level Farm).
- **Restored content:** the full metal chain (iron→**adamantium**, food-fed and
  fractional), weapon tiers (arrow→**gladius/claymore**), unit ladder
  (archer→**centurion/war general**), the **quest-item web** (magic orb / soul
  gem / star metal / holy water) + **Cloud Shaman → dream leaf**, **coin + Bank**,
  the **Castle** (5 tiers → `defenseMax`), and **10 settlement tiers**
  (Small Shack → Kingdom) with the original caps/costs.
- **Combat reworked to defense-based, deterministic:** assaults are repelled by
  the **defense** stat (archers dedicated to the walls, capped by Castle
  `defenseMax`), hexes by **ward** (Wizard Tower `wardMax`).
  `defense ≥ basePower·growth^wave` → repelled + honor and the wave escalates;
  fall short → lose `lossAmount` defense (core resources looted at 0) **and the
  attacker resets to wave 0**. Castle upgrades raise the ceiling you defend to.
- **Engine additions:** numeric/single-slot `workerCap` for converters
  (defense/ward/quests), building-derived caps (`defenseMax`/`wardMax`/`coinMax`)
  in `getCapacity`, tier `requires` thresholds (defense/honor/ward/wisdom, checked
  but not consumed) vs deducted `cost`, `flags` for the manual early game, and a
  v3→v4 save migration.
- **Manual early game + Shop:** forage/chop/mine by hand (hatchet/pickaxe gates)
  before the Farm automates food; recruit extra workers with arrows.
- **Bugs fixed from the original:** the inverted hex chance (`25 − ward/2`), tier
  costs that were checked-but-never-deducted, and the unimplemented multi-level
  Farm.

### Phase 5 — Prestige  *(2–4 days)*
- **G1:** reset for a permanent multiplier currency (Honor-based), with a
  "welcome back stronger" loop.
- **G2:** a **meta upgrade tree** (data-driven) to spend prestige points on.
- **Done when:** resetting is rewarding and the meta-tree adds real depth.

### Phase 6 — Backend-ready hardening  *(as needed, later)*
- Confirm all mutations go through `actions`; add a thin server-authority seam.
- Optional: cloud saves + accounts; then leaderboards. Introduce event-sourcing
  here for anti-cheat if going competitive.
- **Done when:** adding a backend is additive, not a rewrite.

---

## 6. Cross-cutting concerns

- **Balancing:** keep tunable constants in content data; build a tiny dev panel
  to fast-forward time and inspect rates. Curves (cost growth, production) as
  named formulas.
- **Offline math:** step-simulate short gaps; cap long gaps; consider closed-form
  for pure linear producers if fast-forward gets slow.
- **Testing:** tick, offline catch-up, save migration, and combat resolution are
  all pure functions → high-value unit tests.
- **Performance:** batch UI updates (don't re-render every node each tick); Svelte
  fine-grained reactivity + derived stores handle this well.
- **Save safety:** versioned saves + migrations from day one; export/import as a
  backup and a poor-man's cross-device transfer until cloud saves exist.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Data schemas too rigid for odd mechanics | `hook` escape hatch on defs; refine schema in Phase 2 against real v1 content |
| Offline fast-forward too slow for long gaps | Cap gap; closed-form for linear producers |
| Scope creep (jumping to content before core solid) | Phase gates; vertical slice first; original stays the spec |
| Re-render performance under constant ticks | Derived stores + change detection; measured in Phase 3 |
| Save format churn breaking progress | Versioned saves + migration array from Phase 1 |

---

## 8. Immediate next step

Kick off **Phase 0**: scaffold the Svelte 5 + TS + Vite project in a new
`coin-castle/` directory, wire tooling, and port the visual tokens. Then move
straight into the Phase 1 vertical slice.
