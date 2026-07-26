# Vendored icons

Icons used by the game that **aren't in Lucide**. Each is a standalone Svelte
component with the same prop shape as a Lucide icon (`size`, `color`,
`strokeWidth`, plus passthrough attributes), so they drop into `RESOURCE_ICON`
and `GROUP_DEFS` with no call-site changes.

They're vendored rather than installed because we need 13 icons, not the ~6,600
those two packages ship. Adding one is a copy-paste: take the `<path>` data from
the source set and follow the shape of any file here.

| Source                                          | License | Icons                                                                                         |
| ----------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| [Tabler Icons](https://tabler.io/icons) v3.45.0  | MIT     | Book, BuildingStore, CrystalBall, Cube, Diamond, Meteor, MilitaryAward, Needle, ShieldChevron, Spiral, Sword, Trident |
| [Phosphor Icons](https://phosphoricons.com) v2.1.1 | MIT   | Coins                                                                                          |

Tabler matches Lucide's construction exactly (24×24 grid, 2px stroke, round
caps/joins), so its icons sit in a row alongside Lucide's without reading as a
different family. **Phosphor is filled, not stroked** — `Coins` paints with
`fill` on a 256×256 grid and deliberately carries more weight than its
neighbours. Keep that in mind before reaching for more Phosphor icons.
