import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { app, syncModelsAtBoot, chatSSEHandler } from "./routes.js";
import { config, ensureDirs } from "./config.js";
import { seedDefaults } from "./defaults.js";
import { log, logFile } from "./log.js";

ensureDirs();
seedDefaults();
syncModelsAtBoot();

app.onError((err, c) => {
	log("error", "http.error", { method: c.req.method, path: c.req.path, error: err.message, stack: err.stack });
	return c.json({ error: "internal_error", detail: err.message }, 500);
});

// /api/chat is long-lived SSE with per-event flushing; the node-server
// adapter stalls on those streams, so it is served raw on this listener.
const listener = getRequestListener(app.fetch.bind(app));
const server = createServer((req, res) => {
	if (req.method === "GET" && (req.url ?? "").split("?")[0] === "/api/chat") {
		return chatSSEHandler(req, res);
	}
	return listener(req, res);
});

server.listen(config.port, () => {
	log("info", "server.listen", { port: config.port, workspace: config.workspace, state: config.stateDir, log: logFile });
});
