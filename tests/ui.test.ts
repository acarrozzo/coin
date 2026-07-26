// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ResourcePanel from '../src/ui/ResourcePanel.svelte';
import SettlementPanel from '../src/ui/SettlementPanel.svelte';
import { game } from '../src/ui/gameStore.svelte';
import { notify } from '../src/ui/notify.svelte';
import { D } from '../src/engine/numbers';
import { createInitialState } from '../src/engine/state';
import { needsThreatSupply } from '../src/engine/selectors';
import { getNavSections } from '../src/ui/sections';
import { ASSAULT, HEX } from '../src/content/combat';

// Runtime check: proves Svelte 5 runes reactivity + the store wiring + event
// handlers all work together in a real DOM — not just that the engine is correct.
describe('ResourcePanel (runtime)', () => {
  it('renders the unlocked resource and assigns a worker on click', async () => {
    game.state.workers.trained = 1; // Core Resources hidden until first worker trained
    render(ResourcePanel);

    // Wood + stone gather from the start; food needs a Farm, so it's hidden.
    expect(screen.getByText('Wood')).toBeTruthy();
    expect(screen.getByText('Stone')).toBeTruthy();
    expect(screen.queryByText('Food')).toBeNull();

    // already set above; just need at least 1 worker to assign
    const before = game.state.workers.assigned.wood;
    await fireEvent.click(screen.getByLabelText('Add worker to Wood'));

    // Store mutated...
    expect(game.state.workers.assigned.wood).toBe(before + 1);
    // ...and the DOM reactively reflects it. Wood is pool-limited, so its count
    // renders as just the assigned number (no "/max").
    expect(
      await screen.findByText(
        (_, el) =>
          el?.classList.contains('count') === true &&
          el?.textContent?.trim().startsWith(String(before + 1)) === true,
      ),
    ).toBeTruthy();
  });

  it('upgrades the settlement and fires a level-up toast', async () => {
    game.state.level = 1; // skip level 0 so the button reads "Upgrade →"
    game.state.resources.wood.amount = D(20);
    game.state.resources.stone.amount = D(20);
    game.state.resources.food.amount = D(20); // level 1→2 now costs 1 food
    render(SettlementPanel);

    await fireEvent.click(screen.getByText(/Upgrade →/));

    expect(game.state.level).toBe(2);
    expect(notify.toasts.some((t) => t.kind === 'level')).toBe(true);
  });
});

// The rail's threat dots answer "is this track under-supplied?", not "will the
// next wave land" — a full, staffed track stays quiet even when it's outmatched.
describe('threat supply alerts', () => {
  /** A state with combat + hex live and both stats capped by a built structure. */
  function armed() {
    const s = createInitialState(0);
    s.level = HEX.unlockLevel;
    s.buildings.castle.level = 1; // defense cap 5
    s.buildings.wizardtower.level = 1; // ward cap 5
    s.resources.defense.amount = D(5);
    s.resources.ward.amount = D(5);
    s.workers.assigned.defense = 1;
    s.workers.assigned.ward = 1;
    return s;
  }

  it('is quiet when the stat is at cap and the line is staffed', () => {
    expect(needsThreatSupply(armed(), 'defense')).toBe(false);
  });

  it('flags a stat below its cap', () => {
    const s = armed();
    s.resources.defense.amount = D(3);
    expect(needsThreatSupply(s, 'defense')).toBe(true);
  });

  it('flags an unstaffed line even at full stat', () => {
    const s = armed();
    s.workers.assigned.ward = 0;
    expect(needsThreatSupply(s, 'ward')).toBe(true);
  });

  it('stays quiet before the capping building exists', () => {
    const s = armed();
    s.buildings.castle.level = 0; // cap 0 — nothing to supply yet
    s.workers.assigned.defense = 0;
    expect(needsThreatSupply(s, 'defense')).toBe(false);
  });

  it('gives assault and hex their own rail sections, each with its own dot', () => {
    const s = armed();
    s.workers.trained = 2;
    s.resources.defense.amount = D(3); // assault short, hex fine

    const ids = getNavSections(s).map((sec) => sec.id);
    expect(ids).toContain('combat:assault');
    expect(ids).toContain('combat:hex');

    const assault = getNavSections(s).find((sec) => sec.id === 'combat:assault');
    const hex = getNavSections(s).find((sec) => sec.id === 'combat:hex');
    expect(assault?.alert).toBe('warn');
    expect(hex?.alert).toBe(null);
    expect(assault?.count).toBe(1); // workers on the defense line only
  });

  it('omits the hex section until hexes unlock', () => {
    const s = armed();
    s.level = ASSAULT.unlockLevel; // combat live, hex not yet
    const ids = getNavSections(s).map((sec) => sec.id);
    expect(ids).toContain('combat:assault');
    expect(ids).not.toContain('combat:hex');
  });
});
