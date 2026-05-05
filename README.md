# site-monitor

`site-monitor` is a small Node.js service for monitoring HTTP endpoints. It lets operators create monitors, run scheduled checks, group failures into incidents, review dashboard and incident pages, and send webhook alert notifications when incidents open or auto-resolve.

## Run

```sh
npm install
npm start
```

The server listens on `http://127.0.0.1:3000` by default and stores data in `./data/site-monitor.sqlite`.

## Environment

- `PORT`: HTTP port. Default: `3000`.
- `DATABASE_PATH`: SQLite database filename. Default: `./data/site-monitor.sqlite`. Use `:memory:` for an in-memory database.
- `WORKER_INTERVAL_MS`: Scheduler tick interval in milliseconds. Default: `1000`.

## Test

```sh
npm test
```
