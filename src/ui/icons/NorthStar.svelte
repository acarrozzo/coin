<script lang="ts">
  /**
   * Tabler Icons (MIT) — `north-star`, vendored as a component.
   *
   * Mirrors the prop shape of a Lucide icon (`size`, `color`, plus passthrough
   * attributes) so it drops into RESOURCE_ICON / GROUP_DEFS with no call-site
   * changes: <Icon size={18} color="var(--text-muted)" aria-hidden="true" />
   */
  interface Props {
    size?: number | string;
    color?: string;
    /** Matches Lucide's default stroke weight. */
    strokeWidth?: number | string;
    [key: string]: unknown;
  }
  const {
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    ...rest
  }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  {...rest}
>
  <path d="M3 12h18" />
  <path d="M12 21v-18" />
  <path d="M7.5 7.5l9 9" />
  <path d="M7.5 16.5l9 -9" />
</svg>
