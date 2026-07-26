<script lang="ts">
  /**
   * Tabler Icons (MIT) — `trident`, vendored as a component.
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
  <path d="M3 6l2 -2v3a7 7 0 0 0 14 0v-3l2 2" />
  <path d="M12 21v-18l-2 2m4 0l-2 -2" />
</svg>
