// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import ResourcePanel from '../src/ui/ResourcePanel.svelte';
import SettlementPanel from '../src/ui/SettlementPanel.svelte';
import MarketPanel from '../src/ui/MarketPanel.svelte';
import PrestigePanel from '../src/ui/PrestigePanel.svelte';
import App from '../src/App.svelte';
import { game } from '../src/ui/gameStore.svelte';
import { notify } from '../src/ui/notify.svelte';
import { D } from '../src/engine/numbers';
import { createInitialState } from '../src/engine/state';
import { needsThreatSupply } from '../src/engine/selectors';
import { getNavSections, FULL_MARKET_LEVEL } from '../src/ui/sections';
import { nav } from '../src/ui/nav.svelte';
import { ASSAULT, HEX } from '../src/content/combat';
import { SELLABLE_RESOURCES } from '../src/content/market';
import { PRESTIGE_TIERS, PRESTIGE_UNLOCK_LEVEL, MAX_PRESTIGE } from '../src/content/prestige';

// Runtime check: proves Svelte 5 runes reactivity + the store wiring + event
// handlers all work together in a real DOM — not just that the engine is correct.
describe('ResourcePanel (runtime)', () => {
  it('renders the unlocked resource and assigns a worker on click', async () => {
    game.state.workers.trained = 1; // Core Resources hidden until first worker trained
    render(ResourcePanel, { props: { tab: 'settlement' } });

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

// The tab bar switches content: only the selected tab's panels are mounted, and
// the left rail is the table of contents inside the tab you're on.
describe('content tabs (runtime)', () => {
  // Rendering the real App needs two things jsdom/vitest don't provide:
  // `__APP_VERSION__` (a Vite build-time `define`) and ResizeObserver (used by
  // the header's `bind:clientHeight`). scrollIntoView is unimplemented in jsdom.
  //
  // So is the Web Animations API, and that one bites: switching tabs unmounts
  // ResourcePanel's cards, whose `transition:fly` outro calls element.animate().
  // The resulting throw aborts the whole flush — including the $effect that
  // guards the active tab — so it has to be stubbed, not merely tolerated.
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
    // Switching tabs returns the page to the top; jsdom has no scrollTo.
    vi.stubGlobal('scrollTo', vi.fn());
    Element.prototype.animate = vi.fn(() => ({
      cancel() {},
      finished: Promise.resolve(),
      currentTime: 0,
      playState: 'finished',
      startTime: 0,
      effect: null,
      addEventListener() {},
      removeEventListener() {},
    })) as never;
  });

  /** A state deep enough that every tab exists. */
  function full(level = 8) {
    cleanup();
    nav.select('settlement'); // the tab store is a module singleton — reset it
    const gs = game.state;
    gs.level = level;
    gs.workers.trained = 4;
    gs.prestige.level = 0; // keeps the Prestige tab's label off the level suffix
    gs.market.sold = { wood: false, stone: false, arrow: false, spear: false };
    gs.market.rateUnlocks = { wood: false, stone: false, food: false };
    gs.market.contracts = { i: false, ii: false, iii: false };
    gs.market.foodBought = false;
    gs.resources.coin.amount = D(0);
    for (const id of SELLABLE_RESOURCES) gs.resources[id].amount = D(0);
  }

  const tabBar = () => screen.getByRole('tablist', { name: 'Page sections' });
  /** Scoped to the tab bar — the rail has same-named buttons. */
  const tabBtn = (name: RegExp) => within(tabBar()).getByRole('tab', { name }) as HTMLButtonElement;

  it('lists the tabs in progression order, each named for what it holds', () => {
    full();
    render(App);

    const labels = within(tabBar())
      .getAllByRole('tab')
      .map((t) => t.textContent?.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual([
      'Settlement',
      'Crafting',
      'Mysticism Mystic',
      'Quests',
      'Market',
      'Prestige',
    ]);
  });

  it('mounts only the selected tab, and swaps content when another is picked', async () => {
    full();
    render(App);

    // Settlement opens: the settlement, its threats, and what the land yields.
    expect(document.querySelector('[data-nav="settlement"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="combat:assault"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="group:core"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="group:deepmine"]')).toBeTruthy();
    // ...and nothing from any other tab.
    expect(document.querySelector('[data-nav="group:blacksmith"]')).toBeNull();
    expect(document.querySelector('[data-nav="market"]')).toBeNull();

    await fireEvent.click(tabBtn(/^Crafting/));

    // Now the Crafting cards are mounted and the Settlement panels are gone.
    expect(document.querySelector('[data-nav="group:blacksmith"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="settlement"]')).toBeNull();
    expect(document.querySelector('[data-nav="combat:assault"]')).toBeNull();
    expect(document.querySelector('[data-nav="group:core"]')).toBeNull();
  });

  it('groups the workshops under Crafting and leaves the Quest Hall alone on Quests', async () => {
    full();
    render(App);

    // All three workshops share one tab.
    await fireEvent.click(tabBtn(/^Crafting/));
    for (const key of ['group:hunterscabin', 'group:blacksmith', 'group:barracks']) {
      expect(document.querySelector(`[data-nav="${key}"]`), `${key} not on Crafting`).toBeTruthy();
    }

    // Quests holds the Quest Hall and nothing else — the Cloud Shaman moved to
    // Mysticism, alongside the Wizard Tower.
    await fireEvent.click(tabBtn(/^Quests/));
    expect(document.querySelector('[data-nav="group:castle"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="group:cloudshaman"]')).toBeNull();
    expect(screen.getByText('Quest Hall')).toBeTruthy();

    await fireEvent.click(tabBtn(/^Mystic/));
    expect(document.querySelector('[data-nav="group:wizardtower"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="group:cloudshaman"]')).toBeTruthy();
  });

  it('shows only the active tab’s sections in the jump rail', async () => {
    full();
    render(App);

    const railLabels = () =>
      within(screen.getByRole('navigation', { name: 'Jump to section' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));

    // Settlement tab, in page order: the settlement, both threat tracks, then
    // the two gathering cards.
    expect(railLabels()).toEqual(['Settlement', 'Assault', 'Hex', 'Core Resources', 'Deep Mine']);

    await fireEvent.click(tabBtn(/^Crafting/));
    expect(railLabels()).toEqual(["Hunter's Cabin", 'Blacksmith', 'Barracks']);
  });

  it('flags a tab with a dot, never a number', async () => {
    full();
    game.state.resources.wood.amount = D(50); // one sellable
    game.state.resources.coin.amount = D(1); // one affordable (the food supply)
    game.state.workers.assigned.magicorb = 3; // a worker tally that must not show
    render(App);

    const market = tabBtn(/^Market/);
    // A bare count beside "Market" reads as a coin balance, so there is none.
    expect(market.textContent).not.toMatch(/\d/);
    expect(within(market).getByLabelText('Something is waiting here')).toBeTruthy();
    expect(tabBtn(/^Quests/).textContent).not.toMatch(/\d/);

    // The counts still live inside, on the Sell/Buy sub-tabs, where they mean
    // something specific.
    await fireEvent.click(market);
    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /^Buy/ }).textContent).toContain('1');
  });

  it('hides a tab until its content unlocks', () => {
    full(1); // Market unlocked; the Quest Hall (level 4) not yet
    render(App);

    const names = within(tabBar())
      .getAllByRole('tab')
      .map((t) => t.textContent);
    expect(names.some((n) => /Quests/.test(n ?? ''))).toBe(false);
    expect(names.some((n) => /Crafting/.test(n ?? ''))).toBe(false);
    expect(names.some((n) => /Market/.test(n ?? ''))).toBe(true);
  });

  it('falls back to Settlement when the active tab stops existing', async () => {
    full();
    render(App);

    await fireEvent.click(tabBtn(/^Crafting/));
    expect(document.querySelector('[data-nav="group:blacksmith"]')).toBeTruthy();

    // A prestige drops the settlement to level 0, closing every structure tab.
    game.state.level = 0;
    await tick();

    expect(nav.tab).toBe('settlement');
    expect(document.querySelector('[data-nav="settlement"]')).toBeTruthy();
  });

  it('tags every section with the tab that shows it', () => {
    const s = createInitialState(0);
    s.level = 8;
    s.workers.trained = 1;
    const tabOf = (id: string) => getNavSections(s).find((sec) => sec.id === id)?.tab;
    expect(tabOf('group:core')).toBe('settlement');
    expect(tabOf('group:deepmine')).toBe('settlement');
    expect(tabOf('group:hunterscabin')).toBe('crafting');
    expect(tabOf('group:blacksmith')).toBe('crafting');
    expect(tabOf('group:barracks')).toBe('crafting');
    expect(tabOf('group:castle')).toBe('quests');
    expect(tabOf('group:cloudshaman')).toBe('mysticism');
    expect(tabOf('group:wizardtower')).toBe('mysticism');
    expect(tabOf('settlement')).toBe('settlement');
    expect(tabOf('market')).toBe('market');
  });

  it('follows a recipe link onto the tab that produces the ingredient', async () => {
    full();
    render(App);

    // The Blacksmith is built from wood and stone, both gathered back on the
    // Settlement tab — so its cost links point off the Crafting tab.
    await fireEvent.click(tabBtn(/^Crafting/));
    const card = document.querySelector('[data-nav="group:blacksmith"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(document.querySelector('[data-res="stone"]')).toBeNull();

    await fireEvent.click(within(card).getByRole('button', { name: /stone/ }));
    await tick();

    expect(nav.tab).toBe('settlement');
    expect(document.querySelector('[data-res="stone"]')).toBeTruthy();
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

// Prestige is the only screen that destroys progress, so the runtime checks
// here are about the guardrails: the confirm step, and the fact that pressing
// through it really does reset the live store the whole UI is projected from.
describe('PrestigePanel (runtime)', () => {
  /** Level 6 with the first tier's threshold held, on a store cleaned of leftovers. */
  function armed(): void {
    cleanup();
    const gs = game.state;
    gs.prestige.level = 0;
    gs.level = PRESTIGE_UNLOCK_LEVEL;
    gs.workers.trained = 4;
    gs.workers.bonus = 0;
    gs.buildings.farm.level = 3;
    gs.resources.wood.amount = D(500);
    gs.resources.honor.amount = D(1);
    gs.resources.starmetal.amount = D(0);
  }

  it('shows the tier, its held-not-spent threshold, and the keep/lose ledger', () => {
    armed();
    render(PrestigePanel);

    expect(screen.getByText(PRESTIGE_TIERS[0].name)).toBeTruthy();
    expect(screen.getByText('You keep')).toBeTruthy();
    expect(screen.getByText('You lose')).toBeTruthy();
    expect(screen.getByText(/Held, not spent/)).toBeTruthy();
  });

  it('stays disabled without the threshold', () => {
    armed();
    game.state.resources.honor.amount = D(0);
    render(PrestigePanel);

    expect(screen.getByRole('button', { name: 'Prestige' }).hasAttribute('disabled')).toBe(true);
  });

  it('arms a confirm step before it will reset anything', async () => {
    armed();
    render(PrestigePanel);

    await fireEvent.click(screen.getByRole('button', { name: 'Prestige' }));

    // First press only arms it — nothing has been given up yet.
    expect(game.state.prestige.level).toBe(0);
    expect(game.state.level).toBe(PRESTIGE_UNLOCK_LEVEL);
    expect(await screen.findByRole('button', { name: /Confirm/ })).toBeTruthy();
  });

  it('resets the live store on confirm, keeping honor and the new workers', async () => {
    armed();
    render(PrestigePanel);

    await fireEvent.click(screen.getByRole('button', { name: 'Prestige' }));
    await fireEvent.click(await screen.findByRole('button', { name: /Confirm/ }));

    const gs = game.state;
    expect(gs.prestige.level).toBe(1);
    expect(gs.level).toBe(0);
    expect(gs.buildings.farm.level).toBe(0);
    expect(gs.resources.wood.amount.toNumber()).toBe(0);
    expect(gs.workers.bonus).toBe(PRESTIGE_TIERS[0].workers);
    expect(gs.resources.honor.amount.toNumber()).toBe(1);

    // The zone must survive its own reset — level is 0 now, but it stays open.
    expect(getNavSections(gs).map((s) => s.id)).toContain('prestige');
  });
});

// The Prestige card's two sub-tabs, and the prestige level the UI wears once
// one has been claimed.
describe('PrestigePanel — sub-tabs and prestige level', () => {
  function armed(count = 0): void {
    cleanup();
    const gs = game.state;
    gs.prestige.level = count;
    gs.level = PRESTIGE_UNLOCK_LEVEL;
    gs.workers.trained = 4;
    gs.workers.bonus = 0;
    gs.resources.honor.amount = D(1);
    gs.resources.starmetal.amount = D(0);
  }

  const openTab = (name: 'Next' | 'Taken') =>
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));

  it('opens on Next, and Taken is empty before the first prestige', async () => {
    armed();
    render(PrestigePanel);

    expect(screen.getByRole('tab', { name: /^Next/ }).getAttribute('aria-selected')).toBe('true');
    await openTab('Taken');
    expect(screen.getByText(/No legacies yet/)).toBeTruthy();
  });

  it('shows no level in the heading until one is earned', () => {
    armed();
    render(PrestigePanel);
    expect(screen.queryByTitle('Prestige level')).toBeNull();
  });

  it('lands on Taken after prestiging and lists the claimed legacy', async () => {
    armed();
    render(PrestigePanel);

    await fireEvent.click(screen.getByRole('button', { name: 'Prestige' }));
    await fireEvent.click(await screen.findByRole('button', { name: /Confirm/ }));

    // The tab switches itself to the ledger of what was just claimed.
    expect(screen.getByRole('tab', { name: /^Taken/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(PRESTIGE_TIERS[0].name)).toBeTruthy();
    expect(screen.getByText(`${PRESTIGE_TIERS[0].workers} to start`)).toBeTruthy();
    // ...and the heading now wears the prestige level.
    expect(screen.getByTitle('Prestige level').textContent).toContain('Lvl 1');
  });

  it('falls back to Taken once every legacy is claimed', () => {
    armed(MAX_PRESTIGE);
    render(PrestigePanel);

    // Nothing left on Next, so the card opens on the ledger instead.
    expect(screen.getByRole('tab', { name: /^Taken/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByText(/to start$/).length).toBe(MAX_PRESTIGE);
  });

  it('puts the prestige level on the zone label once earned', () => {
    armed(0);
    const before = getNavSections(game.state).find((s) => s.id === 'prestige');
    expect(before?.label).toBe('Prestige');

    game.state.prestige.level = 2;
    const after = getNavSections(game.state).find((s) => s.id === 'prestige');
    expect(after?.label).toBe('Prestige Lvl 2');
  });
});
