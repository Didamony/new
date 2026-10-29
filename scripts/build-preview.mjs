// Builds the demo app as ONE self-contained HTML page (all CSS and JS inline),
// for sandboxed previews that can't load extra files.
// Usage: node scripts/build-preview.mjs [outFile]
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "dist-demo";
const outFile = process.argv[2] ?? join(outDir, "zakerly-preview.html");
execSync(`npx vite build --outDir ${outDir} --emptyOutDir`, { stdio: "inherit", env: { ...process.env, VITE_DEMO: "1" } });

const assets = readdirSync(join(outDir, "assets"));
const read = (ext) => {
  const files = assets.filter((f) => f.endsWith(ext));
  if (files.length !== 1) throw new Error(`expected one ${ext} file, found: ${files.join(", ")}`);
  return readFileSync(join(outDir, "assets", files[0]), "utf8");
};
// Raw control characters and U+FFFD sit inside string literals; write them as escapes.
const clean = (s) => s.replace(/\x1b/g, "\\x1b").replace(/�/g, "\\uFFFD");
const css = read(".css");
const js = clean(read(".js")).replace(/<\/script/gi, "<\\/script");
const icon = readFileSync("public/icon.svg", "utf8");
const html = readFileSync(join(outDir, "index.html"), "utf8");
const themeScript = html.match(/<script>\s*try \{[\s\S]*?<\/script>/)[0];

const page = `<title>ذاكرلي</title>
<meta name="theme-color" content="#6d5efc">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${css}
</style>
${themeScript}
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(outFile, page);
console.log(`wrote ${outFile} (${(page.length / 1e6).toFixed(2)} MB)`);
