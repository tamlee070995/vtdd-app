import sharp from "sharp";
import { mkdir, readdir, writeFile } from "node:fs/promises";

// Derive web assets from the supplied artwork without redrawing the logo.
const source = "assets/brand/vtdd-logo-original.png";
const background = "#07111f";
await mkdir("public/brand", { recursive: true });
await mkdir("public/pwa", { recursive: true });
const png = size => sharp(source).resize(size, size, { fit: "contain" }).png().toBuffer();
const [icon512, icon192, apple180] = await Promise.all([png(512), png(192), sharp(source).resize(180, 180).flatten({ background }).png().toBuffer()]);
await Promise.all([
  writeFile("app/icon.png", icon512), writeFile("app/apple-icon.png", apple180),
  writeFile("public/pwa/icon-512.png", icon512), writeFile("public/pwa/icon-192.png", icon192),
  writeFile("public/pwa/apple-touch-icon.png", apple180), writeFile("public/brand/vtdd-logo-v2.png", icon512),
  sharp(source).resize(256, 256).webp({ quality: 92 }).toFile("public/brand/vtdd-logo-v2.webp"),
  sharp(source).resize(1200, 1200).flatten({ background }).png().toFile("public/brand/share-logo-v2.png"),
]);
const maskableLogo = await png(410);
await sharp({ create: { width: 512, height: 512, channels: 4, background } }).composite([{ input: maskableLogo, gravity: "centre" }]).png().toFile("public/pwa/icon-maskable-512.png");
const sizes = [16, 32, 48, 64];
const images = await Promise.all(sizes.map(png));
const ico = Buffer.alloc(6 + sizes.length * 16 + images.reduce((sum, image) => sum + image.length, 0));
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(sizes.length, 4);
let offset = 6 + sizes.length * 16;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  ico[entry] = sizes[index]; ico[entry + 1] = sizes[index];
  ico.writeUInt16LE(1, entry + 4); ico.writeUInt16LE(32, entry + 6);
  ico.writeUInt32LE(image.length, entry + 8); ico.writeUInt32LE(offset, entry + 12);
  image.copy(ico, offset); offset += image.length;
});
await writeFile("app/favicon.ico", ico);
for (const file of await readdir("public/pwa")) {
  const size = file.match(/^splash-(\d+)x(\d+)\.png$/);
  if (!size) continue;
  const width = Number(size[1]), height = Number(size[2]);
  const logo = await png(Math.round(Math.min(width, height) * .5));
  await sharp({ create: { width, height, channels: 4, background } }).composite([{ input: logo, gravity: "centre" }]).png().toFile(`public/pwa/${file}`);
}
console.log("Updated page logo, sharing image, favicon, app icons and all startup images.");
