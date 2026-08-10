/**
 * 生成 PWA 图标（PNG）— 从 public/icons/icon.svg 栅格化
 *
 * 输出：
 *   public/icons/icon-192.png            192×192 (any)
 *   public/icons/icon-512.png            512×512 (any)
 *   public/icons/icon-maskable-512.png   512×512 (maskable, 全出血背景)
 *   public/icons/apple-touch-icon.png    180×180 (iOS)
 *
 * 用法：npm run icons
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/icons/icon.svg");
const OUT_DIR = path.join(ROOT, "public/icons");

// maskable：全出血背景（无圆角透明区），内容保持在安全区内
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#3B82F6"/>
  <text x="96" y="72" text-anchor="middle" font-size="64" fill="white">🎓</text>
  <text x="96" y="130" text-anchor="middle" font-size="20" fill="white" font-weight="bold">考研助手</text>
</svg>`;

async function toPng(input, size, outFile) {
  await sharp(input)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(OUT_DIR, outFile));
  console.log(`✅ ${outFile} (${size}x${size})`);
}

const svgBuf = readFileSync(SRC);

await toPng(svgBuf, 192, "icon-192.png");
await toPng(svgBuf, 512, "icon-512.png");
await toPng(Buffer.from(MASKABLE_SVG), 512, "icon-maskable-512.png");
await toPng(svgBuf, 180, "apple-touch-icon.png");

console.log("完成。");
