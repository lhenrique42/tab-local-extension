/**
 * Generates extension icons from the design system logo SVG.
 * Run: node scripts/generate-icons.mjs
 *
 * Requires sharp: pnpm add -D sharp (then pnpm install)
 */

import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svg = readFileSync(
    resolve(
        root,
        ".github/skills/tablocal-design-system/project/assets/logo.svg",
    ),
);

const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
    const outPath = resolve(root, `public/icons/${size}.png`);
    const info = await sharp(svg).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${size}px → ${outPath} (${info.size} bytes)`);
}
