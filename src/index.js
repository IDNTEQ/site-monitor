import { createApp } from "./http/app.js";

const DEFAULT_PORT = 3000;
const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);

const app = createApp();
app.listen(port, () => {
  process.stdout.write(`site-monitor listening on http://127.0.0.1:${port}\n`);
});
