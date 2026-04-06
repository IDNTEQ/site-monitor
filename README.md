# site-monitor

Initial implementation slice for `REQ-001`: create and manage HTTP monitors.

## What is included

- SQLite-backed monitor persistence with no external dependencies.
- Server-rendered monitor management pages at `/monitors`.
- JSON monitor APIs at `/api/monitors` and `/api/monitors/:id`.
- Pause, resume, and archive lifecycle controls.
- A scheduled monitor query at `/api/monitors/scheduled` that excludes paused and archived monitors.

## Commands

```bash
npm test
npm start
```

The app listens on `http://localhost:3000` by default and writes data to `data/site-monitor.sqlite`. Override with `PORT` and `SITE_MONITOR_DB_PATH` when needed.
