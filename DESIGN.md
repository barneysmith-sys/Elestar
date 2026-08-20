# Design

<!-- impeccable:design-schema 1 -->

Warm paper. Midnight navy. Editorial type. Grain is stock, not aging.

## Palette

- `--stock` `#F5F0E6`
- `--ink` `#152238`
- `--ink-mid` `#4E4A42` (AA on stock)
- `--rule` `rgba(21, 34, 56, 0.14)`
- `--verify` `#0B5A46` (depth glyph only)
- Chip states: `--ok` `#2D5A27`, `--warn` `#8A6A1F`, `--stop` `#6B3030`
- Dark: stock `#0C1220`, ink `#F5F0E6`, navy gold `#C9B896`

## Type

Display is PP Editorial New (Ultralight, Regular, Ultrabold), Fraunces as fallback. Body is Newsreader. Structure is Geist Mono: nav, labels, records, CTAs.

This product's nine styles still apply. Unclassed copy reads in Newsreader.

## Atmosphere

Fixed grain (multiply, 0.12) and a light vignette sit over the page, under the nav. Not crumpled paper, not sepia, not campaign copy.

## Layout

Record grid everywhere: fixed mono label column, value column, hairline between rows. Section padding 96/64/48. Measure 62ch. Only the hero is a full viewport.

System utilities live in `src/system.css`: wrap/split/stack, cards, chips, fields, tracked labels.

## States

Unresolved (sparse drifting dots), resolving (dots gathering), resolved (solid navy). Outcome never resolves.

## Mark

Official lockup is the SVG lens: four-point star punched from a halftone, horizontal trail, traced Elestar wordmark. Circles via `<use>`. Depth glyph is one star path masked by a dot pattern.

On `/` only: one xerox eye, fixed and centered behind the whole page, resting opacity 0.055, scroll-modulated in the gutters. Body copy sits on `.surface` (stock 0.94). Never a second face plate. Wall cards use each person's real work image. Never a second logo.

## Routes

`/` shared mechanic and fork. `/candidates` second person, defuses rejection first. `/hiring` buyer page: cost, count (10), desk flow, NDA, DKIM, outcome objection.
