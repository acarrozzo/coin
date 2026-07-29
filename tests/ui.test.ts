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
import { getAvailableWorkers, needsThreatSupply, willRepelAssault } from '../src/engine/selectors';
import { getNavSections, getTabs, FULL_MARKET_LEVEL } from '../src/ui/sections';
import { nav } from '../src/ui/nav.svelte';
import { ASSAULT, HEX } from '../src/content/combat';
import { SELLABLE_RESOURCES } from '../src/content/market';
import type { ResourceId } from '../src/content/resources';
import { PRESTIGE_TIERS, PRESTIGE_UNLOCK_LEVEL, MAX_PRESTIGE } from '../src/content/prestige';

// Runtime check: proves Svelte 5 runes reactivity + the store wiring + event
// handlers all work together in a real DOM — not just that the engine is correct.
describe('ResourcePanel (runtime)', () => {
  it('renders the unlocked resource and assigns a worker on click', async () => {
    game.state.workers.trained = 1; // Core Resources hidden until first worker trained
    render(ResourcePanel, { props: { tab: 'resources' } });

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

  // Defense is a toggle line: the workers cell is one switch, and flipping it
  // must change nothing about the worker pool.
  it('switches defense auto-replenish on from the Castle card', async () => {
    cleanup();
    game.state.workers.trained = 2;
    game.state.level = 1; // below the assault unlock, so Defense is still on its own card
    game.state.buildings.castle.level = 1; // Quest Hall card + defense row
    game.state.automation.defense = false;
    render(ResourcePanel, { props: { tab: 'quests' } });

    const auto = screen.getByRole('switch', { name: /Auto/ });
    expect(auto.getAttribute('aria-checked')).toBe('false');
    // No worker controls on this row at all.
    expect(screen.queryByLabelText('Add worker to Defense')).toBeNull();

    // Hovering the button raises the shared AlertFlyout, warning in red-dot
    // language about what leaving it off costs. The whole button is the trigger
    // — the handlers sit on its AlertAnchor wrapper, which is what a pointer
    // enters. (The flyout is aria-hidden, so it's queried from the DOM.)
    const anchor = auto.closest('.anchor')!;
    await fireEvent.mouseEnter(anchor);
    const flyout = document.querySelector('.flyout');
    expect(flyout?.querySelector('.dot.bad')).toBeTruthy();
    expect(flyout?.textContent).toMatch(/Defense/);
    expect(flyout?.textContent).toMatch(/looted/);
    await fireEvent.mouseLeave(anchor);
    expect(document.querySelector('.flyout')).toBeNull();

    const freeBefore = getAvailableWorkers(game.state);
    await fireEvent.click(auto);

    expect(game.state.automation.defense).toBe(true);
    expect(game.state.workers.assigned.defense).toBe(0); // costs no worker
    expect(getAvailableWorkers(game.state)).toBe(freeBefore); // pool untouched
    expect((await screen.findByRole('switch', { name: /Auto/ })).getAttribute('aria-checked')).toBe(
      'true',
    );

    // The store is shared across this file — put the Castle back down so later
    // tests see the tab layout they expect.
    cleanup();
    game.state.buildings.castle.level = 0;
    game.state.automation.defense = false;
  });

  // The rail/tab dots say "Barracks: Archer needed to raise Defense"; landing on
  // the card, the mark says WHICH row that was about.
  it('marks the row a threat track is starved of, and clears it when stocked', async () => {
    cleanup();
    const gs = game.state;
    gs.level = ASSAULT.unlockLevel; // assaults live, so Defense is waiting on archers
    gs.buildings.castle.level = 1; // defense cap > 0
    gs.buildings.barracks.level = 1; // the Archer row exists
    gs.resources.defense.amount = D(0);
    gs.resources.archer.amount = D(0);
    render(ResourcePanel, { props: { tab: 'crafting' } });

    const mark = document.querySelector('[data-res="archer"] .needed');
    expect(mark).toBeTruthy();
    expect(mark?.getAttribute('aria-label')).toMatch(/Needed to raise Defense/);

    // Hovering it explains itself through the same shared flyout.
    await fireEvent.mouseEnter(mark!.closest('.anchor')!);
    expect(document.querySelector('.flyout')?.textContent).toMatch(/Needed to raise Defense/);
    await fireEvent.mouseLeave(mark!.closest('.anchor')!);

    // Make some archers and the mark goes away on its own.
    gs.resources.archer.amount = D(5);
    await tick();
    expect(document.querySelector('[data-res="archer"] .needed')).toBeNull();

    cleanup();
    gs.level = 0;
    gs.buildings.castle.level = 0;
    gs.buildings.barracks.level = 0;
    gs.resources.archer.amount = D(0);
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

// One long page: every tab's content is mounted at once, the tab bar jumps
// between regions of it, and the left rail is the table of contents for the
// whole thing. Both bars are highlighted from scroll position, not from a click.
describe('content tabs (runtime)', () => {
  // Rendering the real App needs two things jsdom/vitest don't provide:
  // `__APP_VERSION__` (a Vite build-time `define`) and ResizeObserver (used by
  // the header's `bind:clientHeight`).
  //
  // The Web Animations API is missing too, and that one bites: a locking
  // structure unmounts ResourcePanel's cards, whose `transition:fly` outro
  // calls element.animate(). The resulting throw aborts the whole flush, so it
  // has to be stubbed, not merely tolerated.
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
    vi.stubGlobal(
      'scrollTo',
      vi.fn(() => {
        scrollTop = 0;
        layout();
      }),
    );
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

    // jsdom has no layout: every getBoundingClientRect() returns zeroes, which
    // would make the scroll-spy believe every anchor sits exactly on the header
    // line and pick whichever came last. So fake a page — every spy anchor
    // stacked in document order, section headers short and sections tall — and
    // let scrollIntoView actually move us. That makes the spy testable end to
    // end rather than something we have to mock around.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      const anchor = this.closest(ANCHORS) as HTMLElement | null;
      // Scrolls to something that isn't an anchor (MainTabs pulling a tab
      // button into view) move nothing.
      if (!anchor) return;
      scrollTop = offsets().get(anchor) ?? 0;
      layout();
    });
  });

  /** The two things the spy measures: section headers and rail sections. */
  const ANCHORS = '[data-nav],[data-region]';
  const SECTION_H = 500;
  const HEADER_H = 60;
  let scrollTop = 0;

  const anchorEls = () => Array.from(document.querySelectorAll<HTMLElement>(ANCHORS));
  const sectionEls = () => Array.from(document.querySelectorAll<HTMLElement>('[data-nav]'));

  /** Where each anchor sits down the fake page, in document order. */
  function offsets(): Map<HTMLElement, number> {
    const out = new Map<HTMLElement, number>();
    let y = 0;
    for (const el of anchorEls()) {
      out.set(el, y);
      // A section header is a single line; a section is a whole panel. The
      // difference is the point — it's the gap a header opens above its region
      // that a sections-only spy would fall into.
      y += el.dataset.region ? HEADER_H : SECTION_H;
    }
    return out;
  }

  /** Stack the currently-mounted anchors down a fake page at the current scroll. */
  function layout() {
    for (const [el, y] of offsets()) {
      const top = y - scrollTop;
      const height = el.dataset.region ? HEADER_H : SECTION_H;
      el.getBoundingClientRect = () =>
        ({ top, bottom: top + height, height, left: 0, right: 0, width: 0 }) as DOMRect;
    }
  }

  /** Scroll so a given section sits right on the header line. */
  function scrollToNav(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-nav="${id}"]`);
    scrollTop = el ? (offsets().get(el) ?? 0) : 0;
    layout();
  }

  /**
   * Re-lay-out, fire a scroll, and let the spy's rAF (and Svelte) catch up.
   * The spy schedules its own frame first, so ours resolves after it has run.
   */
  async function settle() {
    layout();
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await tick();
  }

  /** A state deep enough that every tab exists. */
  function full(level = 8) {
    cleanup();
    nav.select('settlement'); // the tab store is a module singleton — reset it
    scrollTop = 0;
    const gs = game.state;
    gs.level = level;
    gs.workers.trained = 4;
    gs.prestige.level = 0;
    gs.market.sold = { wood: false, stone: false, arrow: false, spear: false };
    gs.market.rateUnlocks = { wood: false, stone: false, food: false };
    gs.market.contracts = { i: false, ii: false, iii: false };
    gs.market.foodBought = false;
    gs.resources.coin.amount = D(0);
    for (const id of SELLABLE_RESOURCES) gs.resources[id].amount = D(0);
  }

  // The bar is a `navigation` landmark, not a tablist: it scrolls to a region
  // rather than swapping what's rendered, so there is no tabpanel to own.
  const tabBar = () => screen.getByRole('navigation', { name: 'Page sections' });
  /** Scoped to the tab bar — the rail has same-named buttons. */
  const tabBtn = (name: RegExp) =>
    within(tabBar()).getByRole('button', { name }) as HTMLButtonElement;
  const railLabels = () =>
    within(screen.getByRole('navigation', { name: 'Jump to section' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
  const sectionIds = () => sectionEls().map((el) => el.dataset.nav);

  it('lists the tabs in progression order, each named for what it holds', () => {
    full();
    render(App);

    const labels = within(tabBar())
      .getAllByRole('button')
      .map((t) => t.textContent?.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual([
      'Settlement',
      'Threats',
      'Resources',
      'Crafting',
      'Quests',
      'Mysticism',
      'Market',
      'Prestige',
    ]);
  });

  it('mounts every tab’s content at once, in one long page', () => {
    full();
    render(App);

    // Nothing is hidden behind a tab: the settlement, every structure card, the
    // Market and Prestige are all in the document from the start.
    for (const key of [
      'settlement',
      'threats',
      'group:core',
      'group:deepmine',
      'group:hunterscabin',
      'group:blacksmith',
      'group:barracks',
      'group:castle',
      'group:wizardtower',
      'group:cloudshaman',
      'market',
      'prestige',
    ]) {
      expect(document.querySelector(`[data-nav="${key}"]`), `${key} missing`).toBeTruthy();
    }
  });

  it('lays the page out in tab order, each tab an unbroken run', () => {
    full();
    render(App);

    // The whole jump model rests on this: a tab can only be a scroll target
    // while its sections sit together, in bar order. Interleave two tabs in
    // GROUP_DEFS and clicking one would land you in the middle of another.
    expect(sectionIds()).toEqual([
      'settlement',
      // Two anchors, one section: the assault and hex panels both answer to the
      // combined `threats` button, and adjacent anchors are still one run.
      'threats',
      'threats',
      'group:core',
      'group:deepmine',
      'group:hunterscabin',
      'group:blacksmith',
      'group:barracks',
      'group:castle',
      'group:wizardtower',
      'group:cloudshaman',
      'market',
      'prestige',
    ]);
  });

  it('groups the workshops under Crafting and leaves the Quest Hall alone on Quests', () => {
    const s = createInitialState(0);
    s.level = 8;
    s.workers.trained = 4;
    const idsOn = (tab: string) =>
      getNavSections(s)
        .filter((sec) => sec.tab === tab)
        .map((sec) => sec.id);

    // All three workshops share one region...
    expect(idsOn('crafting')).toEqual(['group:hunterscabin', 'group:blacksmith', 'group:barracks']);
    // ...the Cloud Shaman sits with the Wizard Tower under Mysticism...
    expect(idsOn('mysticism')).toEqual(['group:wizardtower', 'group:cloudshaman']);
    // ...and Quests holds the Quest Hall alone.
    expect(idsOn('quests')).toEqual(['group:castle']);

    full(); // cleanup() — otherwise the previous test's App is still mounted
    render(App);
    expect(screen.getByText('Quest Hall')).toBeTruthy();
  });

  it('lists every section in the jump rail, across all tabs', () => {
    full();
    render(App);

    // The rail is now the table of contents for the whole page, not for one tab.
    expect(railLabels()).toEqual([
      'Settlement',
      'Threats',
      'Core Resources',
      'Deep Mine',
      "Hunter's Cabin",
      'Blacksmith',
      'Barracks',
      'Quest Hall',
      'Wizard Tower',
      'Cloud Shaman',
      'Market',
      'Prestige',
    ]);
  });

  it('gives each region a big header, matching the tab bar', () => {
    full();
    render(App);

    const heads = Array.from(document.querySelectorAll<HTMLElement>('[data-region]'));
    // One header per tab, same names, same order — the page's sections and the
    // tab bar are the same list read two ways.
    expect(heads.map((h) => h.dataset.region)).toEqual([
      'threats',
      'resources',
      'crafting',
      'quests',
      'mysticism',
      'market',
      'prestige',
    ]);
    // Every tab but the first, which deliberately opens the page bare.
    expect(heads.map((h) => h.textContent?.trim())).toEqual(
      within(tabBar())
        .getAllByRole('button')
        .map((t) => t.textContent?.replace(/\s+/g, ' ').trim().split(' ')[0])
        .slice(1),
    );
    // Real headings, so the page has an outline rather than styled divs.
    expect(heads.every((h) => h.tagName === 'H2')).toBe(true);
  });

  it('gives the opening region no header, whichever region that is', () => {
    // Settlement opens the page, so it goes bare — before Threats exists...
    full(1);
    render(App);
    expect(tabBtn(/^Settlement/)).toBeTruthy();
    expect(document.querySelector('[data-region="settlement"]')).toBeNull();
    expect(document.querySelector('[data-region="threats"]')).toBeNull(); // no tab yet

    // ...and after, when Threats slots in behind it and takes a header.
    full();
    render(App);
    expect(document.querySelector('[data-region="settlement"]')).toBeNull();
    expect(document.querySelector('[data-region="threats"]')).toBeTruthy();
  });

  it('hides the section headers while there is only one region', () => {
    // A brand-new run: no workers trained yet, so Core Resources hasn't opened
    // and the settlement is the only region. The tab bar hides at that point —
    // and a lone "SETTLEMENT" banner with nothing to distinguish it from is
    // just noise, so the headers hide with it.
    full(0);
    game.state.workers.trained = 0;
    render(App);

    expect(screen.queryByRole('navigation', { name: 'Page sections' })).toBeNull();
    expect(document.querySelectorAll('[data-region]').length).toBe(0);
  });

  it('renders the two threat tracks as sibling panels, not one nested pair', () => {
    full();
    render(App);

    // One nav section, two panels — both carry the `threats` anchor, in page
    // order, so the rail button jumps to the assault and stays lit across both.
    const [assault, hex] = Array.from(
      document.querySelectorAll<HTMLElement>('[data-nav="threats"]'),
    );
    expect(assault).toBeTruthy();
    expect(hex).toBeTruthy();

    // Each is its own panel — the hex used to be a bare div inside the
    // assault's frame, which meant it could never carry its own accent.
    expect(assault?.tagName).toBe('SECTION');
    expect(hex?.tagName).toBe('SECTION');
    expect(hex?.classList.contains('panel')).toBe(true);
    expect(assault?.contains(hex!)).toBe(false);
    expect(assault?.parentElement).toBe(hex?.parentElement);
  });

  it('clusters the rail by tab, one divider per boundary', () => {
    full();
    render(App);

    const rail = screen.getByRole('navigation', { name: 'Jump to section' });
    const groups = Array.from(rail.querySelectorAll<HTMLElement>('[role="group"]'));

    // One cluster per tab, labelled with — and in the same order as — the tabs.
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(
      within(tabBar())
        .getAllByRole('button')
        .map((t) => t.textContent?.replace(/\s+/g, ' ').trim().split(' ')[0]),
    );

    // Each cluster holds exactly the sections behind its tab.
    const labelsIn = (g: HTMLElement) =>
      within(g)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));
    expect(labelsIn(groups[0])).toEqual(['Settlement']);
    expect(labelsIn(groups[1])).toEqual(['Threats']);
    expect(labelsIn(groups[2])).toEqual(['Core Resources', 'Deep Mine']);
    expect(labelsIn(groups[3])).toEqual(["Hunter's Cabin", 'Blacksmith', 'Barracks']);
    expect(labelsIn(groups[4])).toEqual(['Quest Hall']);
    expect(labelsIn(groups[5])).toEqual(['Wizard Tower', 'Cloud Shaman']);

    // Dividers sit BETWEEN clusters — never a leading or trailing one.
    expect(rail.querySelectorAll('.rail-div').length).toBe(groups.length - 1);
  });

  // Status dots live on the rail button only. A matching strip under each
  // tab-bar label was built alongside it and cut: a rail button is one card, so
  // a dot there stands for one production line, where a tab spans several cards.
  const STATES = ['producing', 'starved', 'idle', 'wanted'];
  /** The state of each dot in a strip, in strip order (skipping Svelte's scoping class). */
  const statuses = (el: HTMLElement | null) =>
    Array.from(el?.querySelectorAll('.sdot') ?? []).map(
      (d) => STATES.find((s) => d.classList.contains(s)) ?? '?',
    );
  const railBtn = (name: string) =>
    screen
      .getByRole('navigation', { name: 'Jump to section' })
      .querySelector<HTMLElement>(`[aria-label="${name}"]`);

  /**
   * full() resets the level, workers and market but not assignments or
   * buildings, and `game` is a module singleton — so a test that touches those
   * has to put them back or it changes what every later test inherits.
   */
  function restoring<T extends object>(obj: T, run: () => void) {
    const before = { ...obj };
    try {
      run();
    } finally {
      Object.assign(obj, before);
    }
  }

  it('strips the rail buttons only, never the tab bar', () => {
    full();
    restoring(game.state.workers.assigned, () => {
      for (const id of Object.keys(game.state.workers.assigned)) {
        game.state.workers.assigned[id as ResourceId] = 0;
      }
      render(App);

      // A card's lines, in row order. Nothing staffed, so every one reads
      // unmanned rather than producing.
      const core = statuses(railBtn('Core Resources'));
      expect(core.length).toBeGreaterThan(0);
      expect(new Set(core)).toEqual(new Set(['idle']));

      // Sections holding no production lines of their own get no strip at all —
      // the settlement's gathering rows live on the Core Resources card.
      expect(statuses(railBtn('Settlement'))).toEqual([]);
      expect(statuses(railBtn('Market'))).toEqual([]);

      // The tab bar carries alert dots, but never a status strip.
      expect(tabBar().querySelectorAll('.sdot').length).toBe(0);
    });
  });

  // A structure card appears as soon as its building can be BUILT, so it can be
  // on the rail with no lines behind it yet. An empty strip, not a row of dots
  // for resources that don't exist.
  it('adds dots to a crafting card only once its building is raised', async () => {
    full();
    render(App);

    const cabin = game.state.buildings.hunterscabin;
    try {
      expect(statuses(railBtn("Hunter's Cabin"))).toEqual([]);
      cabin.level = 1;
      await tick();
      expect(statuses(railBtn("Hunter's Cabin")).length).toBeGreaterThan(0);
    } finally {
      cabin.level = 0;
    }
  });

  it('turns a dot green when its line is staffed', async () => {
    full();
    const assigned = game.state.workers.assigned;
    const before = assigned.wood;
    try {
      assigned.wood = 0;
      render(App);

      const wood = () => statuses(railBtn('Core Resources'))[0];
      expect(wood()).toBe('idle');
      assigned.wood = 1;
      await tick();
      expect(wood()).toBe('producing');
    } finally {
      assigned.wood = before;
    }
  });

  it('lights the rail divider for the chapter being read', async () => {
    full();
    render(App);
    await settle();

    const lit = () =>
      document
        .querySelector<HTMLElement>('.rail-div.lit')
        ?.nextElementSibling?.getAttribute('aria-label') ?? null;

    // At the top we're in Settlement — the first cluster, which has no divider
    // above it, so nothing is lit.
    expect(lit()).toBeNull();

    scrollToNav('group:blacksmith');
    await settle();
    expect(lit()).toBe('Crafting');
  });

  it('scrolls to a tab’s section header when its tab is clicked', async () => {
    full();
    render(App);
    await settle();

    const jumped = () =>
      (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.contexts as Element[];

    // The header, not the first section — so you land on the name of the place
    // you asked for rather than halfway into its first card.
    await fireEvent.click(tabBtn(/^Crafting/));
    expect(jumped().at(-1)).toBe(document.querySelector('[data-region="crafting"]'));

    await fireEvent.click(tabBtn(/^Mystic/));
    expect(jumped().at(-1)).toBe(document.querySelector('[data-region="mysticism"]'));
  });

  it('keeps the tab highlighted after its own header scrolls past the line', async () => {
    full();
    render(App);
    await settle();

    // The regression this guards: a header sits ABOVE its region's first
    // section, so landing on the header leaves that section still below the
    // sticky line. A sections-only spy reads the section before it — and
    // clicking "Crafting" would leave "Resources" highlighted.
    await fireEvent.click(tabBtn(/^Crafting/));
    await settle();

    expect(nav.tab).toBe('crafting');
    expect(tabBtn(/^Crafting/).getAttribute('aria-current')).toBe('true');
    // The rail agrees, pointing at the first section under that header.
    expect(document.querySelector('.jump-btn.active')?.getAttribute('aria-label')).toBe(
      "Hunter's Cabin",
    );
  });

  it('follows the scroll position with both the tab and the rail', async () => {
    full();
    render(App);
    await settle();

    // Top of the page: the settlement, on the Settlement tab.
    expect(nav.tab).toBe('settlement');
    expect(tabBtn(/^Settlement/).getAttribute('aria-current')).toBe('true');

    // Scroll into the Blacksmith — no click anywhere — and both bars follow.
    scrollToNav('group:blacksmith');
    await settle();

    expect(nav.tab).toBe('crafting');
    expect(tabBtn(/^Crafting/).getAttribute('aria-current')).toBe('true');
    expect(tabBtn(/^Settlement/).hasAttribute('aria-current')).toBe(false);

    // Keep going and the Market region takes over.
    scrollToNav('market');
    await settle();
    expect(nav.tab).toBe('market');
  });

  it('keeps any number inside the dot, never beside the label', () => {
    full();
    game.state.resources.wood.amount = D(50); // one sellable
    game.state.resources.coin.amount = D(1); // one affordable (the food supply)
    game.state.workers.assigned.magicorb = 3; // a worker tally that must not show
    render(App);

    const market = tabBtn(/^Market/);
    // A bare count beside "Market" reads as a coin balance. A count INSIDE the
    // dot reads as a notification badge, which is the point — so the rule is
    // about where the digits sit, not whether any exist.
    const outsideDot = (btn: HTMLElement) => {
      const clone = btn.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.dot').forEach((d) => d.remove());
      return clone.textContent ?? '';
    };
    expect(outsideDot(market)).not.toMatch(/\d/);
    expect(outsideDot(tabBtn(/^Quests/))).not.toMatch(/\d/);
    // The dot names what's waiting rather than saying "something is".
    expect(within(market).getByRole('img').getAttribute('aria-label')).toMatch(/offers ready/);

    // The counts still live inside, on the Sell/Buy sub-tabs, where they mean
    // something specific. No click needed to reach them any more.
    expect(screen.getByRole('tab', { name: /^Sell/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /^Buy/ }).textContent).toContain('1');
  });

  it('counts the dot only when more than one thing waits', () => {
    full();
    // Crafting has three workshops; make two of them affordable at once.
    game.state.resources.wood.amount = D(100_000);
    game.state.resources.stone.amount = D(100_000);
    game.state.resources.food.amount = D(100_000);
    render(App);

    const dotOf = (btn: HTMLElement) => btn.querySelector('.dot');
    const crafting = dotOf(tabBtn(/^Crafting/));
    expect(crafting).toBeTruthy();
    // Whatever the exact count, a multi-alert tab shows it and says so.
    const n = Number(crafting?.textContent);
    expect(n).toBeGreaterThan(1);
    expect(crafting?.getAttribute('aria-label')).toMatch(new RegExp(`^${n} need attention:`));

    // A tab with exactly one waiting item stays a bare dot — "1" is noise.
    const single = getTabs(game.state).find((t) => t.alerts?.length === 1);
    if (single) {
      const dot = dotOf(tabBtn(new RegExp(`^${single.label}`)));
      expect(dot?.textContent).toBe('');
      expect(dot?.getAttribute('aria-label')).toMatch(/^1 needs attention:/);
    }
  });

  it('hides a tab until its content unlocks', () => {
    full(1); // Market unlocked; the Quest Hall (level 4) not yet
    render(App);

    const names = within(tabBar())
      .getAllByRole('button')
      .map((t) => t.textContent);
    expect(names.some((n) => /Quests/.test(n ?? ''))).toBe(false);
    expect(names.some((n) => /Crafting/.test(n ?? ''))).toBe(false);
    expect(names.some((n) => /Market/.test(n ?? ''))).toBe(true);
  });

  it('re-measures when a region closes under the player', async () => {
    full();
    render(App);

    // Park in the Crafting region.
    scrollToNav('group:blacksmith');
    await settle();
    expect(nav.tab).toBe('crafting');

    // A prestige drops the settlement to level 0, closing the workshops. No
    // scroll happens — the spy has to notice the section list changed on its
    // own, or both bars would keep pointing at a card that no longer exists.
    game.state.level = 0;
    await tick();
    layout();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await tick();

    expect(document.querySelector('[data-nav="group:blacksmith"]')).toBeNull();
    expect(document.querySelector('[data-nav="settlement"]')).toBeTruthy();
    // Whatever it settles on, it must be a section that still exists.
    expect(sectionIds()).toContain(nav.tab === 'settlement' ? 'settlement' : 'group:core');
  });

  it('tags every section with the tab that shows it', () => {
    const s = createInitialState(0);
    s.level = 8;
    s.workers.trained = 1;
    const tabOf = (id: string) => getNavSections(s).find((sec) => sec.id === id)?.tab;
    expect(tabOf('group:core')).toBe('resources');
    expect(tabOf('group:deepmine')).toBe('resources');
    expect(tabOf('group:hunterscabin')).toBe('crafting');
    expect(tabOf('group:blacksmith')).toBe('crafting');
    expect(tabOf('group:barracks')).toBe('crafting');
    expect(tabOf('group:castle')).toBe('quests');
    expect(tabOf('group:cloudshaman')).toBe('mysticism');
    expect(tabOf('group:wizardtower')).toBe('mysticism');
    expect(tabOf('settlement')).toBe('settlement');
    expect(tabOf('market')).toBe('market');
    // Both threat tracks left Settlement for one region of their own, so an
    // amber under-supplied dot can't be masked by Settlement's gold upgrade dot.
    expect(tabOf('threats')).toBe('threats');
  });

  it('opens the Threats tab only once assaults begin', () => {
    const s = createInitialState(0);
    s.workers.trained = 1;

    // Before combat unlocks there is no threat section, so no tab and no
    // header — the bar goes straight from Settlement to Resources.
    s.level = 1;
    expect(getTabs(s).map((t) => t.id)).not.toContain('threats');

    // Once it does, the tab inserts itself between the two.
    s.level = 8;
    expect(
      getTabs(s)
        .map((t) => t.id)
        .slice(0, 3),
    ).toEqual(['settlement', 'threats', 'resources']);
  });

  it('follows a recipe link to the row that produces the ingredient', async () => {
    full();
    render(App);
    await settle();

    // The Blacksmith is built from wood and stone, both gathered up in the
    // Resources region — so its cost links point a long way up the page. The
    // row is already mounted (that's the point of the single page), so this is
    // purely a scroll, and the assertion is where it scrolled to.
    const card = document.querySelector('[data-nav="group:blacksmith"]') as HTMLElement;
    expect(card).toBeTruthy();
    const stone = document.querySelector('[data-res="stone"]');
    expect(stone).toBeTruthy();

    await fireEvent.click(within(card).getByRole('button', { name: /stone/ }));
    await tick();

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock
      .contexts as Element[];
    expect(calls.at(-1)).toBe(stone);
    // ...and having scrolled up there, we're reading the Resources region.
    await settle();
    expect(nav.tab).toBe('resources');
  });

  // Every green/red chip that names a resource is a link to where that resource
  // comes from — the cost chips on Settlement and Prestige, and the red
  // starvation warning on a producer row, not just ResourcePanel's own recipes.
  it('follows a settlement cost chip to the resource it names', async () => {
    full();
    render(App);
    await settle();

    const cost = document.querySelector('[data-nav="settlement"] .cost') as HTMLElement;
    const wood = document.querySelector('[data-res="wood"]');
    expect(cost).toBeTruthy();
    expect(wood).toBeTruthy();

    await fireEvent.click(within(cost).getByRole('button', { name: /Wood/ }));
    await tick();

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock
      .contexts as Element[];
    expect(calls.at(-1)).toBe(wood);
  });

  it('follows a starvation warning to the ingredient the line lacks', async () => {
    full();
    // Arrows are forged from wood and stone, so the line needs a Blacksmith to
    // exist at all; staffed with neither ingredient it is starved, and says so
    // in red. Nothing is assigned to wood or stone, so the loop can't refill it
    // out from under the assertion.
    game.state.buildings.blacksmith.level = 1;
    for (const id of ['wood', 'stone'] as const) {
      game.state.workers.assigned[id] = 0;
      game.state.resources[id].amount = D(0);
    }
    game.state.workers.assigned.arrow = 1;
    render(App);
    await settle();

    const wood = document.querySelector('[data-res="wood"]');
    await fireEvent.click(screen.getByRole('button', { name: /needs Wood/ }));
    await tick();

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock
      .contexts as Element[];
    expect(calls.at(-1)).toBe(wood);

    game.state.workers.assigned.arrow = 0;
    game.state.buildings.blacksmith.level = 0;
  });

  it('leaves a chip with no producer row as plain text', async () => {
    full();
    render(App);
    await settle();

    // Honor is won by repelling assaults, never produced, so it has no row to
    // jump to — the tier-1 prestige threshold naming it must not be a button.
    const cost = document.querySelector('[data-nav="prestige"] .cost') as HTMLElement;
    expect(cost).toBeTruthy();
    expect(cost.textContent).toMatch(/Honor/);
    expect(document.querySelector('[data-res="honor"]')).toBeNull();
    expect(within(cost).queryByRole('button', { name: /Honor/ })).toBeNull();
  });
});

// The rail's threat dots answer "is this track under-supplied?", not "will the
// next wave land" — a full track with auto-replenish on stays quiet even when
// it's outmatched.
describe('threat supply alerts', () => {
  /** Combat + hex live, both stats capped by a built structure and auto on. */
  function armed() {
    const s = createInitialState(0);
    s.level = HEX.unlockLevel;
    s.buildings.castle.level = 1; // defense cap 5
    s.buildings.wizardtower.level = 1; // ward cap 5
    s.resources.defense.amount = D(5);
    s.resources.ward.amount = D(5);
    s.automation.defense = true;
    s.automation.ward = true;
    return s;
  }

  it('is quiet when the stat is at cap and auto-replenish is on', () => {
    expect(needsThreatSupply(armed(), 'defense')).toBe(false);
  });

  it('flags a stat below its cap', () => {
    const s = armed();
    s.resources.defense.amount = D(3);
    expect(needsThreatSupply(s, 'defense')).toBe(true);
  });

  it('flags a switched-off line even at full stat', () => {
    const s = armed();
    s.automation.ward = false;
    expect(needsThreatSupply(s, 'ward')).toBe(true);
  });

  it('stays quiet before the capping building exists', () => {
    const s = armed();
    s.buildings.castle.level = 0; // cap 0 — nothing to supply yet
    s.automation.defense = false;
    expect(needsThreatSupply(s, 'defense')).toBe(false);
  });

  // Both tracks share one rail button. Its alert takes the worse of the two, and
  // its two status dots — defense then ward — say which track is the bad one.
  it('gives assault and hex a single rail section, with a dot each', () => {
    const s = armed();
    s.workers.trained = 2;
    s.resources.defense.amount = D(3); // assault short, hex fine

    const ids = getNavSections(s).map((sec) => sec.id);
    expect(ids).toContain('threats');
    expect(ids).not.toContain('combat:assault');
    expect(ids).not.toContain('combat:hex');

    const threats = getNavSections(s).find((sec) => sec.id === 'threats');
    // Defense is below its cap, so the shared alert reddens even though the hex
    // track — at cap and running — has nothing to say.
    expect(threats?.alert?.severity).toBe('bad');
    // One dot per track, in track order, so the red one names which is starved.
    expect(threats?.dots.map((d) => d.id)).toEqual(['defense', 'ward']);
    // Auto-replenish spends no workers, so a threat section never badges one.
    expect(threats?.count).toBe(0);
  });

  it('never flags a wave you cannot do anything about', () => {
    const s = armed();
    // Hopelessly outmatched, but at cap with the line running and stocked:
    // losing is now unavoidable, so there is nothing worth a dot.
    s.combat.assault.wave = 40;
    s.resources.archer.amount = D(10);
    expect(willRepelAssault(s)).toBe(false);
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert).toBe(null);
  });

  it('flags a line blocked for want of its inputs', () => {
    const s = armed();
    s.resources.defense.amount = D(3); // room to produce...
    s.resources.archer.amount = D(0); // ...but nothing to produce it from
    const alert = getNavSections(s).find((sec) => sec.id === 'threats')?.alert;
    expect(alert?.severity).toBe('bad');
    expect(alert?.reason).toBe('No Archer to raise Defense');
  });

  // The shortage is raised twice: on the threat track that's starved, and on
  // the card that makes the thing — which is three tabs away from the panel
  // telling you about it.
  it('also flags the shortage on the card that produces the missing input', () => {
    const s = armed();
    s.buildings.barracks.level = 1; // archers are made here
    s.resources.defense.amount = D(3);
    s.resources.archer.amount = D(0);

    const barracks = getNavSections(s).find((sec) => sec.id === 'group:barracks');
    expect(barracks?.alert).toEqual({
      severity: 'bad',
      reason: 'Archer needed to raise Defense',
    });
  });

  it('groups a card short of two tracks by the stat waiting on it', () => {
    const s = armed();
    s.buildings.barracks.level = 3; // archers (defense) and mages (ward)
    s.resources.defense.amount = D(3);
    s.resources.ward.amount = D(3);
    s.resources.archer.amount = D(0);
    s.resources.mage.amount = D(0);
    s.resources.trollskull.amount = D(100); // the ward's other input is fine

    expect(getNavSections(s).find((sec) => sec.id === 'group:barracks')?.alert?.reason).toBe(
      'Archer needed to raise Defense; Mage needed to raise Ward',
    );
  });

  it('lets a shortage outrank an affordable upgrade on the same card', () => {
    const s = armed();
    s.buildings.barracks.level = 1;
    s.resources.defense.amount = D(3);
    s.resources.archer.amount = D(0);
    // Enough of everything to buy the next Barracks level, which would
    // otherwise post a gold "upgrade affordable" dot on this same card.
    for (const id of ['wood', 'stone', 'food', 'iron', 'steel'] as const) {
      s.resources[id].amount = D(100_000);
    }

    const barracks = getNavSections(s).find((sec) => sec.id === 'group:barracks');
    expect(barracks?.alert?.severity).toBe('bad');
    expect(barracks?.alert?.reason).toMatch(/^Archer needed/);
  });

  it('says nothing on the card once the shortage is covered', () => {
    const s = armed();
    s.buildings.barracks.level = 1;
    s.resources.defense.amount = D(3);
    s.resources.archer.amount = D(5);
    expect(getNavSections(s).find((sec) => sec.id === 'group:barracks')?.alert).toBe(null);
  });

  it('says nothing on the card when the track is full and running', () => {
    const s = armed(); // defense at cap, auto on
    s.buildings.barracks.level = 1;
    s.resources.archer.amount = D(0); // no archers, and no need of any
    expect(getNavSections(s).find((sec) => sec.id === 'group:barracks')?.alert).toBe(null);
    // The threat track itself is equally quiet — the two agree by construction.
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert).toBe(null);
  });

  it('names every missing input, not just the first', () => {
    const s = armed();
    s.resources.ward.amount = D(3);
    s.resources.mage.amount = D(0);
    s.resources.trollskull.amount = D(0); // ward needs both
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert?.reason).toBe(
      'No Mage and Troll Skull to raise Ward',
    );
  });

  it('reports the shortage before the switch, not after', () => {
    const s = armed();
    // Line switched off AND nothing to feed it. Reporting "auto-replenish off"
    // would send you to flip a switch that then couldn't do anything.
    s.automation.defense = false;
    s.resources.archer.amount = D(0);
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert?.reason).toMatch(
      /^No Archer/,
    );
  });

  it('reds a stat below its cap, ambers a merely switched-off line', () => {
    const s = armed();
    s.resources.archer.amount = D(10); // stocked, so inputs are not the issue

    s.resources.defense.amount = D(3);
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert).toEqual({
      severity: 'bad',
      reason: 'Defense below cap',
    });

    // At cap but switched off: worth mentioning, not worth alarming.
    s.resources.defense.amount = D(5);
    s.automation.defense = false;
    expect(getNavSections(s).find((sec) => sec.id === 'threats')?.alert).toEqual({
      severity: 'warn',
      reason: 'Defense auto-replenish off',
    });
  });

  // One button for two tracks, so its dot takes the worse of their two alerts —
  // an amber "switched off" must never hide a red "below cap" on the other side.
  it('takes the worse of the two tracks for the shared dot', () => {
    const s = armed();
    s.workers.trained = 1;
    s.resources.archer.amount = D(10);
    s.resources.mage.amount = D(10);
    s.resources.trollskull.amount = D(100);
    s.resources.ward.amount = D(3); // hex red — below cap
    s.automation.defense = false; // assault amber — merely switched off

    const threats = getTabs(s).find((t) => t.id === 'threats');
    expect(threats?.alerts?.map((a) => [a.id, a.severity])).toEqual([['threats', 'bad']]);
    expect(threats?.alerts?.[0].reason).toBe('Ward below cap');
  });

  // The section arrives with the assault and gains the hex later, so between the
  // two unlocks it is the assault alone — one dot, not a placeholder for two.
  it('carries only the assault dot until hexes unlock', () => {
    const s = armed();
    s.level = ASSAULT.unlockLevel; // combat live, hex not yet
    const threats = getNavSections(s).find((sec) => sec.id === 'threats');
    expect(threats).toBeTruthy();
    expect(threats?.dots.map((d) => d.id)).toEqual(['defense']);
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
