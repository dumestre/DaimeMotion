import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWhisperJson } from "../server/transcription.js";

const inputPath = process.argv[2];
const outDir = process.argv[3] ?? ".";
if (!inputPath) {
  console.error("Uso: tsx scripts/transcribe-to-srt.ts <whisper.json> [outDir]");
  process.exit(1);
}

const raw = readFileSync(resolve(inputPath), "utf8");
const { segments, words, language } = parseWhisperJson(raw);

const srt = segments
  .map((s, i) => `${i + 1}\n${toSrt(s.start)} --> ${toSrt(s.end)}\n${s.text}\n`)
  .join("\n");
writeFileSync(resolve(outDir, "transcript.srt"), srt, "utf8");

const PAUSE_THRESHOLD = 0.8;
const blocks: { start: number; end: number; text: string }[] = [];
let current: { start: number; end: number; text: string } | null = null;
for (const seg of segments) {
  if (!current) {
    current = { start: seg.start, end: seg.end, text: seg.text };
  } else if (seg.start - current.end >= PAUSE_THRESHOLD) {
    blocks.push(current);
    current = { start: seg.start, end: seg.end, text: seg.text };
  } else {
    current.end = seg.end;
    current.text += " " + seg.text;
  }
}
if (current) blocks.push(current);

const blocksMd = blocks
  .map((b, i) => `### Bloco ${i + 1} — ${b.start.toFixed(2)}s → ${b.end.toFixed(2)}s (${(b.end - b.start).toFixed(1)}s)\n${b.text}\n`)
  .join("\n");
writeFileSync(resolve(outDir, "blocks.md"), `# Blocos por pausa (>0.8s) — idioma: ${language}\n\n${blocksMd}`, "utf8");

console.log(`OK: ${segments.length} segmentos, ${words.length} palavras, ${blocks.length} blocos.`);
console.log(`Arquivos: ${resolve(outDir, "transcript.srt")}, ${resolve(outDir, "blocks.md")}`);

function toSrt(sec: number) {
  const ms = Math.round(Math.max(0, sec) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}
