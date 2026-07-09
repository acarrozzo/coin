// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ResourcePanel from '../src/ui/ResourcePanel.svelte';
import { game } from '../src/ui/gameStore.svelte';

// Runtime check: proves Svelte 5 runes reactivity + the store wiring + event
// handlers all work together in a real DOM — not just that the engine is correct.
describe('ResourcePanel (runtime)', () => {
  it('renders the unlocked resource and assigns a worker on click', async () => {
    render(ResourcePanel);

    expect(screen.getByText('Wood')).toBeTruthy();
    // Stone is locked at level 1, so it should not render.
    expect(screen.queryByText('Stone')).toBeNull();

    const before = game.state.workers.assigned.wood;
    await fireEvent.click(screen.getByLabelText('Add worker to Wood'));

    // Store mutated...
    expect(game.state.workers.assigned.wood).toBe(before + 1);
    // ...and the DOM reactively reflects it.
    expect(await screen.findByText(`${before + 1} 👷`)).toBeTruthy();
  });
});
