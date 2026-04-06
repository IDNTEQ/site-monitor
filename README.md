# site-monitor

Minimal dashboard implementation for issue `#8 [NFR-003] Dashboard load time`.

## Commands

- `npm start` starts the local dashboard server on `http://127.0.0.1:3000`
- `npm test` runs the fixture, filter, and payload-budget tests
- `npm run perf:budget` measures initial HTML size and server-side render time
- `npm exec --yes --package=puppeteer --package=lighthouse --package=chrome-launcher node scripts/lighthouse-profile.mjs` runs an optional Lighthouse pass with temporary browser tooling

## Scope

The current implementation is intentionally narrow:

- primary dashboard content is server-rendered in the first document
- the 30-day dataset slice is represented as precomputed monitor aggregates
- filter interactions happen client-side without a full page reload
- there are no external frontend dependencies or font/network requests on first paint
