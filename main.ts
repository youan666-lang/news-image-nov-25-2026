// News image entry — Wednesday 25 November 2026.
//
// The front page held beside this program sums up that day's world
// news in one printed page: the Ukraine strike in the Gulf of Finland
// leads, with Riyadh, Huawei, the CIA, Sarkozy, Congo and the
// Thanksgiving turkeys below it. This program does no drawing and no
// fetching: it checks the held page against the gate and copies it to
// /output/entry.png, so two runs always write the same bytes.
//
// The held page is a 1024x1024 JPEG, resized from the generated
// 1600x1600 master; the size and dimension checks below still guard
// the real limits, so a wrong file fails here instead of on the server.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT_BYTES = 1048576;
const LIMIT_PIXELS = 1024;
const SOURCE = "entry.png";

type Size = { w: number; h: number };

function sniffFormat(head: Buffer): "png" | "jpeg" | null {
  // A PNG opens with its 8-byte signature; a JPEG opens with SOI.
  // Anything else is not an image the gate accepts.
  if (head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "png";
  if (head[0] === 0xff && head[1] === 0xd8) return "jpeg";
  return null;
}

function pngSize(head: Buffer): Size {
  // The IHDR chunk follows the signature: width and height are the
  // big-endian 32-bit integers at offsets 16 and 20.
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

function jpegSize(head: Buffer): Size {
  // Walk the segments from the SOI marker until a Start Of Frame
  // marker carries the dimensions; the length field of each segment
  // says how far to step. A file with no frame is not whole.
  let at = 2;
  while (at + 9 < head.length) {
    if (head[at] !== 0xff) throw new Error("entry.png is not a whole JPEG image");
    const mark = head[at + 1];
    const span = head.readUInt16BE(at + 2);
    if (mark >= 0xc0 && mark <= 0xcf && mark !== 0xc4 && mark !== 0xc8 && mark !== 0xcc) {
      return { w: head.readUInt16BE(at + 7), h: head.readUInt16BE(at + 5) };
    }
    at += 2 + span;
  }
  throw new Error("entry.png has no JPEG frame to measure");
}

function checkEntry(file: string): void {
  const head = fs.readFileSync(file);
  const format = sniffFormat(head);
  if (format === null) throw new Error("entry.png is neither a PNG nor a JPEG image");
  const size = format === "png" ? pngSize(head) : jpegSize(head);
  if (size.w > LIMIT_PIXELS || size.h > LIMIT_PIXELS) {
    throw new Error(`entry.png is ${size.w}x${size.h}, over the ${LIMIT_PIXELS}x${LIMIT_PIXELS} cap`);
  }
  const bytes = fs.statSync(file).size;
  if (bytes > LIMIT_BYTES) throw new Error(`entry.png is ${bytes} bytes, over the 1 MiB cap`);
}

function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = path.join(here, SOURCE);
  // Check first, copy second: a bad page must fail loudly here,
  // never land in the output directory half-checked.
  checkEntry(source);
  const outDir = path.resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(source, path.join(outDir, SOURCE));
}

main();
