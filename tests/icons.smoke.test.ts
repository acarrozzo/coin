// @vitest-environment jsdom
/**
 * Guards the resource → icon map. Honor and Wisdom shipped with no icon at all
 * for a while: RESOURCE_ICON was a Partial<Record<…>>, so the missing entries
 * were legal TypeScript and just rendered blank rows.
 *
 * The map is a total Record now, which catches a *missing* key at compile time.
 * This covers the rest: that every entry is a real component, that it honours
 * the `size` prop the panels pass it, and that it actually draws something —
 * which the type system can't know, especially for the vendored (non-Lucide)
 * icons in src/ui/icons.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { RESOURCE_ICON } from '../src/ui/resourceIcons';
import { RESOURCE_IDS } from '../src/content/resources';

describe('resource icons', () => {
  it('renders a non-empty, correctly sized svg for every resource', () => {
    for (const id of RESOURCE_IDS) {
      const Icon = RESOURCE_ICON[id];
      expect(Icon, `${id} has no icon`).toBeTruthy();

      const { container } = render(Icon, { props: { size: 18, 'aria-hidden': 'true' } });
      const svg = container.querySelector('svg');

      expect(svg, `${id} rendered no <svg>`).toBeTruthy();
      expect(svg!.getAttribute('width'), `${id} ignored the size prop`).toBe('18');
      expect(svg!.children.length, `${id} rendered an empty <svg>`).toBeGreaterThan(0);
    }
  });
});
