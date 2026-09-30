import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
const port = Number(process.env.PORT || 8137);
createServer((req, res) => {
  const path = req.url.split("?")[0].replace(/\/$/, "/index.html").replace(/^\//, "");
  const file = join("dist", path);
  if (!existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "text/plain" });
  res.end(readFileSync(file));
}).listen(port, () => console.log("preview on :" + port));
