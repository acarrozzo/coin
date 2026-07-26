<script lang="ts">
  /**
   * Tabler Icons (MIT) — `military-rank`, vendored as a component.
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
  <path d="M18 7v12a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-12l6 -4l6 4" />
  <path d="M10 13l2 -1l2 1" />
  <path d="M10 17l2 -1l2 1" />
  <path d="M10 9l2 -1l2 1" />
</svg>
