<script lang="ts">
  /**
   * A strip of production-line health dots — one per resource, in row order.
   *
   * Green producing, amber waiting on an ingredient, grey unmanned, red unmanned
   * while something running is short of it (see getResourceStatus). This is a
   * different question from the alert dot the rail button also carries: that one
   * says "there is something to click in here", this says "is the economy in
   * here actually running". They sit side by side deliberately.
   *
   * Lives along the bottom edge of a jump rail button. A matching strip under
   * each tab-bar label was built alongside this one and cut after comparing the
   * two in play — the rail is where a dot can stand for a single card, and so
   * for a single production line; a tab spans several cards, which made its
   * strip a wall of dots that named nothing in particular.
   *
   * Purely presentational: sections.ts decides which dots exist and what they
   * mean.
   *
   * Position is meaning here. A dot identifies its line by where it sits in the
   * strip, so the list is never sorted or filtered by state — a dot that moved
   * when it changed colour would be unreadable at a glance, which is the only
   * way these are ever read.
   */
  import type { StatusDot } from './sections';

  interface Props {
    dots: StatusDot[];
  }

  const { dots }: Props = $props();

  /**
   * What a screen reader hears instead of the strip. The dots themselves are
   * aria-hidden — thirty individually announced list items is not navigation,
   * it's an obstacle — so this one sentence is their entire spoken form, and it
   * reports only what's wrong. An all-green strip says nothing at all, which is
   * correct: there is nothing there to act on.
   */
  const summary = $derived.by(() => {
    const notable = dots.filter((d) => d.status !== 'producing');
    if (notable.length === 0) return '';
    return `${notable.length} of ${dots.length} lines need attention: ${notable
      .map((d) => d.reason)
      .join('; ')}`;
  });
</script>

{#if dots.length > 0}
  <span class="strip" role={summary ? 'img' : undefined} aria-label={summary || undefined}>
    {#each dots as d (d.id)}
      <span class="sdot {d.status}" title={d.reason} aria-hidden="true"></span>
    {/each}
  </span>
{/if}

<style>
  /* Along the bottom edge of the 44px rail tile, one row and never wrapped: the
     largest section has 5 lines (5×4px + 4×2px = 28px), so it always fits.
     Shrink rather than wrap if a future card outgrows that. */
  .strip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex-wrap: nowrap;
    pointer-events: none;
  }

  .sdot {
    width: 4px;
    height: 4px;
    min-width: 3px;
    border-radius: 999px;
    flex: 0 0 auto;
    /* Tooltips need to be hoverable even though the strip as a whole must not
       swallow clicks meant for the button underneath it. */
    pointer-events: auto;
  }

  /* Four states, four colours. Green/amber/red are the same tokens the alert
     dots use, so the two systems don't teach conflicting palettes; grey is
     --text-muted, which is already "nothing happening here" everywhere else. */
  .sdot.producing {
    background: var(--good);
  }
  .sdot.starved {
    background: var(--warn);
  }
  .sdot.idle {
    /* Dimmed rather than full --text-muted: an unstaffed line is the resting
       state of most of the game, and at full strength a row of grey dots reads
       as louder than the green ones it sits beside. */
    background: color-mix(in srgb, var(--text-muted) 45%, transparent);
  }
  /* Red pulses as well as reddens. Hue alone can't separate red from green for
     red-green colour blindness in every palette — and not at all in the
     single-hue amber one — so the one state that means "you are losing output
     right now" carries a non-chromatic signal too. */
  .sdot.wanted {
    background: var(--bad);
    animation: dotPulse 1.8s ease-in-out infinite;
  }
  @keyframes dotPulse {
    0%,
    100% {
      opacity: 1;
    }
    55% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sdot.wanted {
      animation: none;
    }
  }
</style>
