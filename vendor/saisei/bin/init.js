#!/usr/bin/env node
/* blueprint-init — scaffolds the kit into any folder. No dependencies.
   Usage: npx @chomuiro/saisei init [dir]   (default: ./blueprint-site) */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const target = path.resolve(process.argv[3] === "init" ? process.argv[4] : process.argv[2] || "blueprint-site");

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) { console.log("keep  " + path.relative(process.cwd(), to) + " (exists)"); return; }
  fs.copyFileSync(path.join(root, from), to);
  console.log("wrote " + path.relative(process.cwd(), to));
}

copy("dist/blueprint.css", path.join(target, "blueprint.css"));
copy("dist/blueprint.js", path.join(target, "blueprint.js"));
copy("examples/plain-html.html", path.join(target, "index.html"));

console.log("\nNext: cd " + path.relative(process.cwd(), target) + " && python3 -m http.server 8000");
console.log("Copy more blocks from the kit's index.html as needed.");
