import { mkdir, writeFile } from "node:fs/promises";

// Run when updating font assets; builds and page requests never contact Google Fonts.
const response = await fetch("https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36" },
});
if (!response.ok) throw new Error(`Google Fonts: ${response.status}`);
const css = await response.text();
const wanted = new Set(["latin", "latin-ext", "vietnamese"]);
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)].filter(match => wanted.has(match[1]));
if (blocks.length !== 6) throw new Error("Expected six Roboto variable font subsets.");
const directory = "public/fonts/roboto";
await mkdir(directory, { recursive: true });
const faces = [];
for (const [, subset, block] of blocks) {
  const url = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
  if (!url || !block.includes("100 900")) throw new Error(`Missing variable WOFF2 font: ${subset}`);
  const style = block.includes("font-style: italic") ? "italic" : "normal";
  const file = `roboto-${subset}-${style}.woff2`;
  const fontResponse = await fetch(url);
  if (!fontResponse.ok) throw new Error(`Font download: ${fontResponse.status}`);
  const bytes = Buffer.from(await fontResponse.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "wOF2") throw new Error("Invalid font file.");
  await writeFile(`${directory}/${file}`, bytes);
  faces.push(`/* ${subset}, ${style} */\n${block.replace(url, `/fonts/roboto/${file}`)}`);
}
const localCss = `${faces.join("\n\n")}\n`;
await writeFile(`${directory}/roboto.css`, localCss);
await writeFile("app/roboto.css", localCss);
const licenseResponse = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/OFL.txt");
if (!licenseResponse.ok) throw new Error(`Font license: ${licenseResponse.status}`);
await writeFile(`${directory}/OFL.txt`, (await licenseResponse.text()).replace(/[ \t]+$/gm, ""));
console.log("Saved Roboto normal/italic variable fonts for Latin, extended Latin and Vietnamese, with license.");
