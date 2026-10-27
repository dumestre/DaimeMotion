import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2] ?? "NARRACAO.md";
const outDir = process.argv[3] ?? ".";
const raw = readFileSync(resolve(inputPath), "utf8");

// Palavras por minuto (estimativa para PT-BR didático)
const WPM = 140;
const MS_PER_WORD = 60000 / WPM;

// Divide por cenas: "## Cena XX — ..."
const sceneRegex = /^##\s+Cena\s+(\d+)\s*[—-]\s*(.+)$/m;
// Remove seção de observações de produção
const cleanRaw = raw.replace(/##\s*Observa[çc][õo]es[\s\S]*$/i, "").trim();

// Cena 01 = texto antes do primeiro "## Cena"
const firstSceneIdx = cleanRaw.search(/^##\s+Cena\s+/m);
let cena01Text = "";
let rest = cleanRaw;
if (firstSceneIdx > 0) {
  cena01Text = cleanRaw.slice(0, firstSceneIdx).trim();
  rest = cleanRaw.slice(firstSceneIdx);
}
// Remove título principal
cena01Text = cena01Text.replace(/^#\s+.+\n/, "").trim();

const parts = rest.split(/^##\s+Cena\s+/m).slice(1);

// Injeta Cena 01 no início se houver texto
if (cena01Text.length > 0) {
  parts.unshift(`01 — O que é o fascismo?\n\n${cena01Text}`);
}


interface Scene {
  number: string;
  title: string;
  paragraphs: string[];
  words: number;
  estDurationSec: number;
}

const scenes: Scene[] = parts.map((part) => {
  const lines = part.split("\n");
  const head = lines[0].trim();
  const m = head.match(/^(\d+)\s*[—-]\s*(.+)$/);
  const number = m ? m[1] : "?";
  const title = m ? m[2].trim() : head;
  const body = lines.slice(1).join("\n").trim();
  // parágrafos = blocos separados por linha em branco
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0 && !p.startsWith("##"));
  const text = paragraphs.join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const estDurationSec = (words * MS_PER_WORD) / 1000;
  return { number, title, paragraphs, words, estDurationSec };
});

// Gera CENAS.md
let md = `# Plano de cenas — duração estimada (base: ${WPM} palavras/min)\n\n`;
let cursor = 0;
const timeline: { scene: string; start: number; end: number; paragraphs: { idx: number; text: string; estSec: number }[] }[] = [];

for (const scene of scenes) {
  const paraInfos = scene.paragraphs.map((p, idx) => {
    const w = p.split(/\s+/).filter(Boolean).length;
    return { idx: idx + 1, text: p, estSec: (w * MS_PER_WORD) / 1000 };
  });
  const sceneStart = cursor;
  cursor += scene.estDurationSec;
  timeline.push({ scene: `${scene.number} — ${scene.title}`, start: sceneStart, end: cursor, paragraphs: paraInfos });
  md += `## Cena ${scene.number} — ${scene.title}\n`;
  md += `- Palavras: ${scene.words} · Duração estimada: ${scene.estDurationSec.toFixed(1)}s\n`;
  md += `- Início: ${sceneStart.toFixed(1)}s · Fim: ${cursor.toFixed(1)}s\n`;
  md += `- Pontos-chave (parágrafos):\n`;
  paraInfos.forEach((p) => {
    md += `  - P${p.idx} (${p.estSec.toFixed(1)}s): ${p.text.slice(0, 90)}${p.text.length > 90 ? "..." : ""}\n`;
  });
  md += `\n`;
}

md += `\n## Resumo\n`;
md += `- Total de cenas: ${scenes.length}\n`;
md += `- Duração total estimada: ${cursor.toFixed(1)}s (${(cursor / 60).toFixed(1)} min)\n`;
md += `- Pontos-chave totais: ${scenes.reduce((a, s) => a + s.paragraphs.length, 0)}\n`;

writeFileSync(resolve(outDir, "CENAS.md"), md, "utf8");

// Gera SRT estimado (1 legenda por parágrafo)
const srtLines: string[] = [];
let idx = 1;
let t = 0;
for (const scene of scenes) {
  for (const p of scene.paragraphs) {
    const w = p.split(/\s+/).filter(Boolean).length;
    const dur = (w * MS_PER_WORD) / 1000;
    const start = t;
    const end = t + dur;
    t = end + 0.3; // pequena pausa entre parágrafos
    srtLines.push(`${idx}\n${toSrt(start)} --> ${toSrt(end)}\n${p}\n`);
    idx++;
  }
}
writeFileSync(resolve(outDir, "narracao-estimada.srt"), srtLines.join("\n"), "utf8");

console.log(`OK: ${scenes.length} cenas, duração total estimada ${cursor.toFixed(1)}s.`);
console.log(`Arquivos: ${resolve(outDir, "CENAS.md")}, ${resolve(outDir, "narracao-estimada.srt")}`);

function toSrt(sec: number) {
  const ms = Math.round(Math.max(0, sec) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}
