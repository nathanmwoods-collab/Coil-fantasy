# Coil Fantasy

Free season-long fantasy football: redraft, keeper, dynasty and best ball. As deep as MFL, as easy as Sleeper. No picks, no ads, no deposits.

Separate from Coil Best Ball (`nathanmwoods-collab/coil`); same brand and stack (Expo + React Native + TypeScript + expo-router + zustand).

## What's here

- `src/engine/` pure TypeScript league rules, fully unit tested: settings and validation, scoring (presets, position overrides, bonuses, tiered PPR, kicker and D/ST tiers), rosters and lineups (flex/superflex, IR with configurable designations, taxi), injury tags, draft order (snake, linear, third-round reversal, auction settings, keepers, lottery), future picks and pick trading, schedule, standings (median game, all-play), playoffs, FAAB and rolling waivers, trades and review, projections baseline, league chat model.
- `src/import/` moving a league to Coil: Sleeper importer (settings, scoring, rosters, IR, taxi, FAAB, traded picks, history), paste-anything roster import with fuzzy player matching, and one-link team claiming.
- `src/data/` sports data adapter; MySportsFeeds implementation.
- `src/news/` breaking-news pipeline (player/status matching, dedupe, approve queue, targeted pushes), source trust (trusted/review/blocked) grouped National + 32 teams, monthly source audit.
- `src/app/` the preview app (demo data).

## Commands

```bash
npm install
npm test          # vitest
npm run typecheck
npx expo start
```

Web preview: `npx expo export --platform web` then `python3 scripts/build-preview.py dist preview.html`.

## Before launch

- Verify MySportsFeeds and Sleeper field mappings against live responses (built from docs; the dev container could not reach either API).
- Confirm data licensing (MySportsFeeds tier) and player headshot rights.
- Demo players, projections and stats in `src/demo/` are placeholders.
