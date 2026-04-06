import { createApp } from "./http/app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp();

app.listen(port, () => {
  process.stdout.write(`site-monitor listening on http://127.0.0.1:${port}\n`);
});
