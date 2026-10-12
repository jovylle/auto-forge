import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
for (const f of ["index.html", "style.css", "app.js"]) copyFileSync(f, "dist/" + f);
console.log("built dist/ with relative asset paths");
