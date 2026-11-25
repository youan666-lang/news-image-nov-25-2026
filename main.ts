// News image entry for 25 November 2026.
// The front page in entry.png sums up that day's world news in a single
// image: one front page, not a collage of separate stories.
// The program copies the front page held beside it to /output/entry.png.
// No network, no drawing, no randomness: the same bytes every run, so
// both grader runs write identical output. The held image is the
// 1024x1024 resize of the generated front page (the generator's master
// was 1600x1600, over the gate's 1024 limit), so checkImage's size and
// dimension checks still guard the real limits.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;
const SOURCE_NAME = "entry.png";
const OUTPUT_NAME = "entry.png";

function imageDimensions(path: string): { width: number; height: number } {
  // PNG header: 8-byte signature, then the IHDR chunk, with width and
  // height as big-endian 32-bit integers at offsets 16 and 20. JPEG
  // files start with SOI and carry dimensions in a SOF segment instead.
  // Reject anything that is neither before parsing, so a stray file
  // fails here with a clear message instead of a confusing offset read.
  const head = readFileSync(path);
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isJpeg = head[0] === 0xff && head[1] === 0xd8;
  if (!isPng && !isJpeg) {
    throw new Error(`${SOURCE_NAME} is not a PNG or JPEG image`);
  }
  if (isPng) {
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  }
  // JPEG: walk segments until a Start Of Frame marker gives dimensions.
  let offset = 2;
  while (offset + 9 < head.length) {
    if (head[offset] !== 0xff) throw new Error("not a PNG or JPEG image");
    const marker = head[offset + 1];
    const length = head.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: head.readUInt16BE(offset + 7), height: head.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error("could not read image dimensions");
}

function checkImage(path: string): void {
  const { width, height } = imageDimensions(path);
  if (width > MAX_SIDE || height > MAX_SIDE) {
    throw new Error(
      `${SOURCE_NAME} is ${width}x${height}, over the ${MAX_SIDE}x${MAX_SIDE} limit`,
    );
  }
  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) {
    throw new Error(`${SOURCE_NAME} is ${bytes} bytes, over the 1 MiB limit`);
  }
}

function main(): void {
  const source = fileURLToPath(new URL(`./${SOURCE_NAME}`, import.meta.url));
  // Validate before copying: a too-big file must fail here, not after a
  // bad image has already been written to the output directory.
  checkImage(source);
  const targetDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  copyFileSync(source, join(targetDir, OUTPUT_NAME));
}

main();
