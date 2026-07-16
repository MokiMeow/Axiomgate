import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { createLoginServer } from "./app.js";

const entryPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (entryPath === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createLoginServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Synthetic login demo listening on http://127.0.0.1:${port}`);
  });
}
