# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite HMR)
npm run build      # production build → dist/
npm run lint       # ESLint
npm run preview    # preview production build locally
```

No test suite exists. Manual testing via browser is the only verification path.

## Project overview

**RinconMundial** is a family World Cup 2026 prediction game ("polla familiar") for exactly three users: Domiciano (`domi`), Juliana (`juliana`), and Papa (`papa`). It's a React + Vite SPA deployed to GitHub Pages at `/RinconMundial/`.

## Architecture

The entire app lives in **one file**: `src/App.jsx` (~1550 lines). There are no sub-components. All state, logic, and JSX for the three views (Inicio, Predicciones, Ranking) are co-located there.

Supporting files:
- `src/firebase.js` — Firebase app init, exports `auth` and `db`
- `src/worldcup.json` — Static match data (bundled at build time, from openfootball/worldcup.json)
- `public/flags/` — Country flag PNGs served as static assets
- `scripts/seed-predictions.js` — One-off admin script using `firebase-admin` (not part of the app)
- `worldcup2026.ics` — iCal export of the World Cup schedule (for reference; not consumed by the app)

## Firebase Firestore

Three collections:
- `users` — one doc per user, keyed by `uid`; written on every login with `merge: true`
- `predictions` — one doc per (user × match), keyed as `${userEmail}_${matchId}`
- `official_results` — one doc per match, keyed by `matchId`; auto-written by the ESPN polling logic

## Match IDs

Match IDs are generated as `match_<arrayIndex>_<team1[0:3]>_<team2[0:3]>` (e.g. `match_0_Mex_Can`). **Changing the order of matches in `worldcup.json` will break all existing Firestore references.**

## Scoring system (additive, max 7 pts per match)

| Condition | Points |
|-----------|--------|
| Exact score | +3 |
| Correct winner / draw | +2 |
| Correct home goals | +1 |
| Correct away goals | +1 |

## Access control

Login requires:
1. Hardcoded passphrase `hkx213bp` (constant `SANTO_Y_SENA` in App.jsx)
2. Google Sign-In via Firebase Auth
3. Email must contain `domi`, `juliana`, or `papa` (substring check, case-insensitive)

Invite flow: `?invite` query param triggers a welcome screen after first login.

## Live scores

The app polls ESPN's public scoreboard API (`site.api.espn.com`) every 60 seconds for matches that have kicked off. Scores are auto-saved to `official_results` in Firestore. Team names from ESPN are remapped via the `ESPN_TO_LOCAL_TEAM` map in App.jsx before matching against local JSON team names.

## Timezone

All date logic uses `America/Bogota` (GMT-5) as the reference timezone. The selected default date on load is "today in Bogotá."

## Deploy

Pushes to `main` trigger GitHub Actions (`deploy.yml`) which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages. The Vite `base` is `/RinconMundial/`.
