// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/svelte';
import ResourcePanel from '../src/ui/ResourcePanel.svelte';
import SettlementPanel from '../src/ui/SettlementPanel.svelte';
import MarketPanel from '../src/ui/MarketPanel.svelte';
import App from '../src/App.svelte';
import { game } from '../src/ui/gameStore.svelte';
import { notify } from '../src/ui/notify.svelte';
import { D } from '../src/engine/numbers';
import { createInitialState } from '../src/engine/state';
import { needsThreatSupply } from '../src/engine/selectors';
import { getNavSections, FULL_MARKET_LEVEL } from '../src/ui/sections';
import { ASSAULT, HEX } from '../src/content/combat';
import { getTier } from '../src/content/settlement';
import { SELLABLE_RESOURCES } from '../src/content/market';

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

// Every Market offer renders through MarketOffer, so mounting the panel proves
// the whole card system works at runtime — the Decimal-driven shortfall bar,
// the one-and-done removal, the level-gated locked state, and the Sell/Buy tabs.
describe('MarketPanel (runtime)', () => {
  // The store is shared across tests and its `state` is read-only, so the
  // Market's own fields are reset in place rather than swapping the state.
  function resetMarket(level: number): void {
    cleanup();
    const gs = game.state;
    gs.level = level;
    gs.market.sold = { wood: false, stone: false, arrow: false, spear: false };
    gs.market.rateUnlocks = { wood: false, stone: false, food: false };
    gs.market.contracts = { i: false, ii: false, iii: false };
    gs.market.foodBought = false;
    gs.market.coinEarned = D(0);
    gs.resources.coin.amount = D(0);
    // Every sellable resource, or stock left by an earlier test leaks in as a
    // sale the badge would count.
    for (const id of SELLABLE_RESOURCES) gs.resources[id].amount = D(0);
  }

  /** Sell and Buy live in separate tabs now, so most checks need one of them. */
  const openTab = (name: 'Sell' | 'Buy') =>
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));

  it('locks level-gated offers below the full-market level, with the reason', async () => {
    resetMarket(1);
    render(MarketPanel);

    // Gated sales stay on the board rather than vanishing, stating the blocker.
    expect(screen.getByText('Arrows Needed')).toBeTruthy();
    expect(screen.getByText('Wood Needed')).toBeTruthy(); // ungated
    expect(
      screen.getAllByText(`Requires Settlement Level ${FULL_MARKET_LEVEL}`).length,
    ).toBeGreaterThan(0);

    // Same on the Buy side.
    await openTab('Buy');
    expect(screen.getByText('Worker Contract III')).toBeTruthy();
    expect(
      screen.getAllByText(`Requires Settlement Level ${FULL_MARKET_LEVEL}`).length,
    ).toBeGreaterThan(0);
  });

  it('unlocks the gated offers, and a sale removes its card for good', async () => {
    resetMarket(FULL_MARKET_LEVEL);
    game.state.resources.arrow.amount = D(500);
    render(MarketPanel);

    expect(screen.getByText('Arrows Needed')).toBeTruthy();
    expect(screen.queryByText(`Requires Settlement Level ${FULL_MARKET_LEVEL}`)).toBeNull();

    await fireEvent.click(screen.getByText('Sell for 10'));

    expect(game.state.market.sold.arrow).toBe(true);
    // One and done: the offer leaves the board rather than advancing a tier,
    // even though 400 arrows are still on hand.
    expect(screen.queryByText('Arrows Needed')).toBeNull();
  });

  it('offers all three Worker Contracts at once, in no fixed order', async () => {
    resetMarket(FULL_MARKET_LEVEL);
    render(MarketPanel);

    await openTab('Buy');
    expect(screen.getByText('Worker Contract I')).toBeTruthy();
    expect(screen.getByText('Worker Contract II')).toBeTruthy();
    expect(screen.getByText('Worker Contract III')).toBeTruthy();
  });

  it('splits sells and buys across the two tabs', async () => {
    resetMarket(FULL_MARKET_LEVEL);
    render(MarketPanel);

    // Sell is the default tab, and Buy's offers are not in the document.
    expect(screen.getByText('Wood Needed')).toBeTruthy();
    expect(screen.queryByText('Emergency Food Supply')).toBeNull();

    await openTab('Buy');
    expect(screen.getByText('Emergency Food Supply')).toBeTruthy();
    expect(screen.queryByText('Wood Needed')).toBeNull();
  });

  it('badges each tab with what can be acted on right now', async () => {
    resetMarket(FULL_MARKET_LEVEL);
    // Enough stock for the wood, stone and spear sales, and coin for the food.
    game.state.resources.wood.amount = D(50);
    game.state.resources.stone.amount = D(50);
    game.state.resources.spear.amount = D(50);
    game.state.resources.coin.amount = D(1);
    render(MarketPanel);

    // wood + stone + spear are sellable (arrows are not — none on hand).
    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('3');
    // Only the 1-coin food supply is affordable.
    expect(screen.getByRole('tab', { name: /^Buy/ }).textContent).toContain('1');

    // Taking an offer drops its tab's badge.
    await fireEvent.click(screen.getByText('Sell for 10')); // the spear sale
    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('2');
  });

  it('does not badge a level-gated offer you cannot act on', () => {
    resetMarket(1); // below FULL_MARKET_LEVEL
    game.state.resources.arrow.amount = D(9_999); // stock is there, the level is not
    render(MarketPanel);

    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('0');
  });

  it('keeps the Sell tab with an empty state once every sale is taken', async () => {
    resetMarket(FULL_MARKET_LEVEL);
    game.state.market.sold = { wood: true, stone: true, arrow: true, spear: true };
    render(MarketPanel);

    // With nothing left to sell the panel opens on Buy rather than an empty tab.
    expect(screen.getByRole('tab', { name: /^Buy/ }).getAttribute('aria-selected')).toBe('true');

    // Sell is still there, and says so plainly.
    await openTab('Sell');
    expect(screen.getByText('The merchant needs nothing more.')).toBeTruthy();
    // The completed sales are still reachable in that tab's own ledger.
    expect(screen.getByText('4 sold')).toBeTruthy();
  });

  it('shows the shortfall on an unaffordable trade', () => {
    resetMarket(FULL_MARKET_LEVEL);
    game.state.resources.spear.amount = D(6);
    render(MarketPanel);

    // 6 of the 10 spears the sale needs.
    expect(screen.getByText(/6 of 10\s+spears/)).toBeTruthy();
    expect(screen.getByText('Need 4 more')).toBeTruthy();
  });
});

// The zone bar looks like tabs but navigates: the page is one continuous scroll
// holding all three zones, and pressing one scrolls to it.
describe('page zones (runtime)', () => {
  // Rendering the real App needs two things jsdom/vitest don't provide:
  // `__APP_VERSION__` (a Vite build-time `define`) and ResizeObserver (used by
  // the header's `bind:clientHeight`). scrollIntoView is unimplemented in jsdom.
  beforeAll(() => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  /** A state deep enough that all three zones exist. */
  function full(level = 8) {
    cleanup();
    const gs = game.state;
    gs.level = level;
    gs.workers.trained = 4;
    gs.market.sold = { wood: false, stone: false, arrow: false, spear: false };
    gs.market.rateUnlocks = { wood: false, stone: false, food: false };
    gs.market.contracts = { i: false, ii: false, iii: false };
    gs.market.foodBought = false;
    gs.resources.coin.amount = D(0);
    for (const id of SELLABLE_RESOURCES) gs.resources[id].amount = D(0);
  }

  /** Scoped to the zone bar — the rail has same-named buttons. */
  const zoneBtn = (name: RegExp) =>
    within(screen.getByRole('navigation', { name: 'Page sections' })).getByRole('button', {
      name,
    }) as HTMLButtonElement;

  it('renders every zone at once, so the whole page is scrollable', () => {
    full();
    render(App);

    // All three zones are in the DOM simultaneously — nothing is switched out.
    expect(document.querySelector('[data-zone="settlement"]')).toBeTruthy();
    expect(document.querySelector('[data-zone="quests"]')).toBeTruthy();
    expect(document.querySelector('[data-zone="market"]')).toBeTruthy();

    // ...including each zone's actual content.
    expect(document.querySelector('[data-nav="settlement"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="group:castle"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="market"]')).toBeTruthy();
  });

  it('scrolls to a zone rather than switching to it', async () => {
    full();
    render(App);

    const market = document.querySelector('[data-zone="market"]')!;
    const spy = vi.spyOn(market, 'scrollIntoView');

    await fireEvent.click(zoneBtn(/^Market/));

    expect(spy).toHaveBeenCalled();
    // The settlement zone is still mounted — nothing was swapped away.
    expect(document.querySelector('[data-zone="settlement"]')).toBeTruthy();
  });

  it('names the first zone after the settlement itself', () => {
    full(6);
    render(App);

    const first = screen.getByRole('navigation', { name: 'Page sections' })
      .firstElementChild as HTMLElement;
    expect(first.textContent).toContain('Lvl 6');
    expect(first.textContent).toContain(getTier(6)?.name);
  });

  it('flags the Market zone with a dot, never a number', () => {
    full();
    game.state.resources.wood.amount = D(50); // one sellable
    game.state.resources.coin.amount = D(1); // one affordable (the food supply)
    render(App);

    const market = zoneBtn(/^Market/);
    // A bare count beside "Market" reads as a coin balance, so there is none.
    expect(market.textContent).not.toMatch(/\d/);
    expect(within(market).getByLabelText('Something is waiting here')).toBeTruthy();

    // The counts still live inside, on the Sell/Buy sub-tabs, where they mean
    // something specific.
    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /^Buy/ }).textContent).toContain('1');
  });

  it('shows no worker tally on the Quests zone', () => {
    full();
    game.state.workers.assigned.magicorb = 3;
    render(App);

    expect(zoneBtn(/^Quests/).textContent).not.toMatch(/\d/);
  });

  it('keeps the jump rail on screen and lists every zone in it', () => {
    full();
    render(App);

    expect(screen.getByRole('navigation', { name: 'Jump to section' })).toBeTruthy();

    const s = createInitialState(0);
    s.level = 8;
    s.workers.trained = 1;
    const ids = getNavSections(s).map((sec) => sec.id);
    expect(ids).toContain('group:core'); // settlement zone
    expect(ids).toContain('group:castle'); // quests zone
    expect(ids).toContain('group:cloudshaman'); // quests zone — Cloud Shaman moved here
    expect(ids).toContain('market'); // market zone
  });

  it('puts the Castle and Cloud Shaman in the Quests zone, not the Settlement one', () => {
    const s = createInitialState(0);
    s.level = 8;
    s.workers.trained = 1;
    const zoneOf = (id: string) => getNavSections(s).find((sec) => sec.id === id)?.zone;
    expect(zoneOf('group:castle')).toBe('quests');
    expect(zoneOf('group:cloudshaman')).toBe('quests');
    expect(zoneOf('group:core')).toBe('settlement');
    expect(zoneOf('market')).toBe('market');
  });

  it('hides a zone, and its bar entry, until it has content', () => {
    full(1); // Market unlocked; Quest Lands (level 4) not yet
    render(App);

    expect(document.querySelector('[data-zone="quests"]')).toBeNull();
    expect(
      within(screen.getByRole('navigation', { name: 'Page sections' })).queryByRole('button', {
        name: /^Quests/,
      }),
    ).toBeNull();
    expect(document.querySelector('[data-zone="market"]')).toBeTruthy();
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
