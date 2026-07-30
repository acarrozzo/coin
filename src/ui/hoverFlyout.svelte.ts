/**
 * Open/close state for a hover flyout that CONTAINS controls.
 *
 * Plain CSS `:hover` is enough for a tooltip, but not for these: the cursor has
 * to be able to leave the trigger, cross the gap, and click −/+ or a link inside
 * the card repeatedly. So open state lives in JS across the trigger and the card
 * together, and a leave starts a short grace timer rather than closing outright.
 *
 * Pointer-driven: a touch pointer never opens it (there is no hover on touch, and
 * a tap on the trigger should do the trigger's own job). Focus opens it too, so a
 * keyboard can reach the controls inside; a focus that lands outside the group
 * closes it at once — focus doesn't travel through the dead space a pointer does.
 *
 * Hover and pin are tracked separately and the card is open when either is on, so
 * they can't fight: a host whose trigger is a button can hand `toggle` to its
 * click and give touch a way in, while a host whose trigger already does
 * something on click (the header gauge jumps) simply never calls it.
 *
 * One instance per trigger. Handlers are arrow properties so they can be passed
 * straight to `on*` attributes without losing `this`.
 */
const CLOSE_GRACE_MS = 200;

export class HoverFlyout {
  hovered = $state(false);
  pinned = $state(false);

  get open(): boolean {
    return this.hovered || this.pinned;
  }

  #timer = 0;

  show = (): void => {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = 0;
    }
    this.hovered = true;
  };

  scheduleClose = (): void => {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.hovered = false;
      this.#timer = 0;
    }, CLOSE_GRACE_MS);
  };

  onPointerEnter = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') this.show();
  };

  onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(next)) {
      return;
    }
    this.hovered = false;
    this.pinned = false;
  };

  /** Click/tap on a trigger that has nothing else to do: keeps the card up after
      the pointer leaves, and is the only way in on touch. */
  toggle = (): void => {
    this.pinned = !this.pinned;
  };

  /** Light dismiss — Escape, or a click outside the group. */
  dismiss = (): void => {
    this.hovered = false;
    this.pinned = false;
  };

  /** Call from the host's `$effect` teardown — a pending timer must not fire
      into a destroyed component. */
  dispose = (): void => {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = 0;
  };

  /** Escape closes a pinned card, wherever focus happens to be. */
  onWindowKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.pinned) this.dismiss();
  };
}
