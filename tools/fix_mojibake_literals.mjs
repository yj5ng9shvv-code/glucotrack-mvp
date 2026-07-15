import fs from "node:fs";
import { TextDecoder } from "node:util";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node tools/fix_mojibake_literals.mjs <files...>");
  process.exit(2);
}

const decoder = new TextDecoder("windows-1251");
const reverse = new Map();
for (let byte = 0; byte < 256; byte += 1) {
  reverse.set(decoder.decode(Uint8Array.of(byte)), byte);
}

const marker = /(Р[^\s"'`,.:;!?)]|С[^\s"'`,.:;!?)]|Г[^\s"'`,.:;!?)]|Д[^\s"'`,.:;!?)]|Е[^\s"'`,.:;!?)]|В[^\s"'`,.:;!?)]|И[^\s"'`,.:;!?)]|а[^\s"'`,.:;!?)]|б[^\s"'`,.:;!?)]|г[^\s"'`,.:;!?)]|д[^\s"'`,.:;!?)]|е[^\s"'`,.:;!?)]|ж[^\s"'`,.:;!?)]|з[^\s"'`,.:;!?)]|н[^\s"'`,.:;!?)]|п[^\s"'`,.:;!?)]|вЂ)/;

function restore(value) {
  const bytes = [];
  for (const char of value) {
    if (!reverse.has(char)) return value;
    bytes.push(reverse.get(char));
  }
  const restored = Buffer.from(bytes).toString("utf8");
  return restored.includes("\uFFFD") ? value : restored;
}

function fixText(text) {
  return text.replace(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g, (match, quote, body) => {
    if (!marker.test(body)) return match;
    const fixed = restore(body);
    if (fixed === body) return match;
    return `${quote}${fixed.replaceAll("\\", "\\\\").replaceAll(quote, `\\${quote}`)}${quote}`;
  });
}

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixText(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    console.log(`fixed ${file}`);
  }
}
