import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

const execAsync = promisify(exec);

export interface TtsVoice {
  id: string;
  name: string;
  gender: "feminino" | "masculino";
}

export const ptBrVoices: TtsVoice[] = [
  { id: "pf_dora", name: "Dora", gender: "feminino" },
  { id: "pm_alex", name: "Alex", gender: "masculino" },
  { id: "pm_santa", name: "Santa", gender: "masculino" },
];

const PYTHON = "C:\\Users\\DJDUM\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";
const FFMPEG = "C:\\Program Files\\Bitwig Studio\\bin\\ffmpeg.exe";
const SAMPLE_RATE = 24000;

/** Durações de silêncio padrão (ms) inseridas entre trechos da narração. */
export const DEFAULT_PAUSES: TtsPauseOptions = {
  pauseCommaMs: 120,
  pauseSentenceMs: 350,
  pauseParagraphMs: 700,
};

export interface TtsPauseOptions {
  /** Silêncio após vírgula, ponto e vírgula e dois-pontos. */
  pauseCommaMs: number;
  /** Silêncio após ponto, exclamação, interrogação e reticências. */
  pauseSentenceMs: number;
  /** Silêncio entre parágrafos. */
  pauseParagraphMs: number;
}

export interface TtsOptions {
  text: string;
  voiceId?: string;
  /** Velocidade do Kokoro (1 = normal). */
  speed?: number;
  /** Compatibilidade com o formato antigo de porcentagem ("+15%"). */
  rate?: string;
  pauseCommaMs?: number;
  pauseSentenceMs?: number;
  pauseParagraphMs?: number;
}

/** Trecho de fala enviado ao Kokoro, com o silêncio que vem depois dele. */
export interface TtsSpeechUnit {
  text: string;
  gapMs: number;
}

function normalizeVoiceId(voiceId?: string): string {
  if (voiceId && ptBrVoices.some((v) => v.id === voiceId)) {
    return voiceId;
  }
  return "pf_dora";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Converte a velocidade para o fator do Kokoro.
 * Aceita número (1.15) ou porcentagem no formato antigo ("+15%").
 */
export function parseSpeed(value?: string | number): number {
  if (typeof value === "number") return clampNumber(value, 0.5, 2, 1);
  if (!value) return 1;
  const percent = /^\s*([+-]?\d+(?:[.,]\d+)?)\s*%\s*$/.exec(value);
  if (percent) return clampNumber(1 + Number(percent[1].replace(",", ".")) / 100, 0.5, 2, 1);
  const plain = String(value).replace(",", ".");
  return clampNumber(Number(plain), 0.5, 2, 1);
}

/**
 * Corrige texto que foi decodificado com a codificação errada (cp1252 -> UTF-8).
 * Ex.: "nÃ£o" volta a ser "não".
 */
function repairMojibake(text: string): string {
  if (!/[ÃÂ][\u0080-\u00BF]/.test(text)) return text;
  // Só tenta reparar quando todo o conteúdo cabe em latin1 (caso clássico do mojibake).
  if (/[^\u0000-\u00FF]/.test(text)) return text;
  const repaired = Buffer.from(text, "latin1").toString("utf8");
  if (repaired.includes("\uFFFD")) return text;
  const count = (value: string) => (value.match(/[ÃÂ][\u0080-\u00BF]/g) ?? []).length;
  return count(repaired) < count(text) ? repaired : text;
}

/**
 * Prepara o texto para o TTS: remove markdown e lixo de formatação,
 * mas PRESERVA acentos (á, ã, ê, ç...), que mudam a pronúncia no Kokoro.
 */
export function normalizeTextForTts(input: string): string {
  let text = repairMojibake(input ?? "");
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Seção de observações/notas de produção (cabeçalho markdown ou rótulo isolado)
  const headingCut = text.search(/^[ \t]{0,3}#{1,6}[ \t]*(?:observa|notas?\b)/im);
  const labelCut = text.search(
    /^[ \t]*(?:observa[çc][õo]es?(?:[ \t]+de[ \t]+produ[çc][ãa]o)?|notas?[ \t]+de[ \t]+produ[çc][ãa]o)[ \t]*:?[ \t]*$/im,
  );
  const cutoff = [headingCut, labelCut].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
  if (cutoff >= 0) text = text.slice(0, cutoff);

  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'");

  // Imagens e links markdown
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Cabeçalhos, separadores, citações, listas e tabelas
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+.*$/gm, "");
  text = text.replace(/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm, "");
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  text = text.replace(/^[ \t]{0,3}(?:[-*+])[ \t]+/gm, "");
  text = text.replace(/^[ \t]{0,3}\d+[.)][ \t]+/gm, "");
  text = text.replace(/^[ \t]{0,3}\|.*\|[ \t]*$/gm, "");

  // Ênfase e código
  text = text.replace(/(\*\*|__)(.+?)\1/g, "$2");
  text = text.replace(/(\*|_)(.+?)\1/g, "$2");
  text = text.replace(/`{1,3}([^`]*)`{1,3}/g, "$1");
  text = text.replace(/~~(.+?)~~/g, "$1");

  // Aspas e travessões tipográficos viram pontuação simples
  text = text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*([.!?…])/g, "$1");

  // Caracteres de controle (mantém \n e \t)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");

  // Normaliza espaços/quebras preservando acentos (NFC)
  text = text.normalize("NFC");
  text = text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;:])\s+/);
  return sentences.filter((s) => s.trim().length > 0);
}

/** Abreviações comuns que não devem quebrar a frase no ponto. */
const ABBREVIATIONS = new Set([
  "sr", "sra", "sras", "dr", "dra", "dras", "prof", "profa", "eng", "engª",
  "etc", "obs", "vol", "cap", "fig", "num", "art", "av", "tv", "pág", "pag",
]);

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?…])\s+/);
  const merged: string[] = [];
  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;
    if (merged.length > 0) {
      const previous = merged[merged.length - 1];
      const word = (previous.replace(/[.!?…]+$/, "").match(/[\p{L}]+$/u)?.[0] ?? "").toLowerCase();
      const isAbbreviation = ABBREVIATIONS.has(word) || word.length === 1;
      if (isAbbreviation) {
        merged[merged.length - 1] = `${previous} ${piece}`;
        continue;
      }
    }
    merged.push(piece);
  }
  return merged;
}

function splitClauses(sentence: string): string[] {
  return sentence
    .split(/(?<=[,;:])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Divide o texto em trechos de fala e define o silêncio depois de cada um.
 * Usado para ter controle real de pausa: o Kokoro quase não pausa em
 * vírgulas e pontos (medido: ~12 ms por vírgula, ~20 ms por ponto).
 */
export function splitIntoSpeechUnits(
  text: string,
  pauses: Partial<TtsPauseOptions> = {},
): TtsSpeechUnit[] {
  const pauseCommaMs = clampNumber(pauses.pauseCommaMs, 0, 1500, 0);
  const pauseSentenceMs = clampNumber(pauses.pauseSentenceMs, 0, 3000, 0);
  const pauseParagraphMs = clampNumber(pauses.pauseParagraphMs, 0, 5000, 0);

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) return [];
  if (pauseCommaMs === 0 && pauseSentenceMs === 0 && pauseParagraphMs === 0) {
    return [{ text: paragraphs.join(" "), gapMs: 0 }];
  }

  const units: TtsSpeechUnit[] = [];
  for (const paragraph of paragraphs) {
    const pieces: string[] = [];
    for (const sentence of splitSentences(paragraph)) {
      if (pauseCommaMs > 0) pieces.push(...splitClauses(sentence));
      else pieces.push(sentence);
    }

    pieces.forEach((piece, index) => {
      const isLastOfParagraph = index === pieces.length - 1;
      let gapMs = 0;
      if (isLastOfParagraph) gapMs = pauseParagraphMs;
      else if (/[.!?…]$/.test(piece)) gapMs = pauseSentenceMs;
      else if (/[,;:]$/.test(piece)) gapMs = pauseCommaMs;
      units.push({ text: piece, gapMs });
    });
  }
  return units;
}

export function splitTextIntoChunks(text: string, maxChunkSize = 2000): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChunkSize) return [normalized];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim().length > 0);

  let current = "";

  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;

    if (p.length > maxChunkSize) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      const sentences = splitBySentences(p);
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (!s) continue;
        if ((current + " " + s).trim().length > maxChunkSize && current.trim()) {
          chunks.push(current.trim());
          current = s;
        } else {
          current = current ? current + " " + s : s;
        }
      }
      continue;
    }

    if ((current + "\n\n" + p).trim().length > maxChunkSize && current.trim()) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk);
      continue;
    }
    const words = chunk.split(/\s+/);
    let cur = "";
    for (const word of words) {
      if ((cur + " " + word).trim().length > maxChunkSize && cur.trim()) {
        finalChunks.push(cur.trim());
        cur = word;
      } else {
        cur = cur ? cur + " " + word : word;
      }
    }
    if (cur.trim()) finalChunks.push(cur.trim());
  }

  return finalChunks.length > 0 ? finalChunks : [normalized];
}

/**
 * Gera o WAV de um bloco: sintetiza cada trecho de fala separadamente
 * (Kokoro gera vários segmentos por trecho) e insere o silêncio configurado
 * entre eles, aparando o silêncio que o próprio modelo adiciona no fim.
 */
async function generateChunkWav(
  units: TtsSpeechUnit[],
  voice: string,
  outWavPath: string,
  tmpBase: string,
  index: number,
  speed: number,
): Promise<void> {
  const stamp = `${Date.now()}_${process.pid}_${index}`;
  const unitsFile = path.join(tmpBase, `tts_units_${stamp}.json`);
  const scriptFile = path.join(tmpBase, `tts_chunk_${stamp}.py`);

  await fs.writeFile(unitsFile, JSON.stringify(units), "utf8");

  // O Kokoro divide o texto em varios segmentos e gera um audio por segmento.
  // E preciso acumular TODOS os segmentos e concatenar antes de gravar,
  // senao o arquivo final fica apenas com o ultimo (ou o primeiro) trecho.
  const py = `import json
import numpy as np
import soundfile as sf
from kokoro import KPipeline

units_path = r"""${unitsFile.replace(/\\/g, "\\\\")}"""
out_path = r"""${outWavPath.replace(/\\/g, "\\\\")}"""
voice = "${voice}"
speed = ${speed.toFixed(3)}
SR = ${SAMPLE_RATE}

with open(units_path, "r", encoding="utf-8") as f:
    units = json.load(f)

pipeline = KPipeline(lang_code="p")


def trim_silence(audio, keep_ms=10.0, threshold=0.004):
    """Apara o silencio das pontas para a pausa ter a duracao exata."""
    if audio.size == 0:
        return audio
    loud = np.where(np.abs(audio) > threshold)[0]
    if loud.size == 0:
        return audio[:0]
    start = max(0, int(loud[0]) - int(SR * 0.01))
    end = min(audio.size, int(loud[-1]) + int(SR * keep_ms / 1000.0))
    return audio[start:end]


pieces = []
segments_total = 0
for unit in units:
    segments = []
    for _gs, _ps, audio in pipeline(unit["text"], voice=voice, speed=speed):
        if audio is None:
            continue
        segments.append(np.asarray(audio, dtype=np.float32).reshape(-1))
    if not segments:
        continue
    segments_total += len(segments)
    pieces.append(trim_silence(np.concatenate(segments)))
    gap = int(SR * max(0.0, float(unit.get("gapMs", 0))) / 1000.0)
    if gap > 0:
        pieces.append(np.zeros(gap, dtype=np.float32))

pieces = [piece for piece in pieces if piece.size > 0]
if not pieces:
    raise RuntimeError("Kokoro nao gerou audio para este trecho.")

merged = np.concatenate(pieces)
sf.write(out_path, merged, SR)
print(f"done units={len(units)} segments={segments_total} samples={merged.shape[0]}")
`;

  await fs.writeFile(scriptFile, py, "utf8");

  try {
    await execAsync(`"${PYTHON}" "${scriptFile}"`, { timeout: 10 * 60 * 1000 });
  } finally {
    await fs.unlink(unitsFile).catch(() => {});
    await fs.unlink(scriptFile).catch(() => {});
  }
}

async function concatenateWavsToMp3(wavPaths: string[], outputMp3Path: string, tmpBase: string): Promise<void> {
  const concatListPath = path.join(tmpBase, `tts_concat_${Date.now()}_${process.pid}.txt`);
  const mergedWavPath = path.join(tmpBase, `tts_merged_${Date.now()}_${process.pid}.wav`);

  const listContent = wavPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  await fs.writeFile(concatListPath, listContent, "utf8");

  try {
    await execAsync(
      `"${FFMPEG}" -hide_banner -loglevel error -f concat -safe 0 -i "${concatListPath}" -ar ${SAMPLE_RATE} -ac 1 -c:a pcm_s16le -y "${mergedWavPath}"`,
      { timeout: 10 * 60 * 1000 },
    );

    await execAsync(
      `"${FFMPEG}" -hide_banner -loglevel error -i "${mergedWavPath}" -codec:a libmp3lame -qscale:a 2 -y "${outputMp3Path}"`,
      { timeout: 10 * 60 * 1000 },
    );
  } finally {
    await fs.unlink(concatListPath).catch(() => {});
    await fs.unlink(mergedWavPath).catch(() => {});
    await Promise.all(wavPaths.map((p) => fs.unlink(p).catch(() => {})));
  }
}

export async function synthesizeTtsBuffer(options: TtsOptions): Promise<Buffer> {
  const voice = normalizeVoiceId(options.voiceId);
  const text = normalizeTextForTts(options.text || "");
  if (!text.trim()) {
    throw new Error("Texto vazio para síntese de voz.");
  }

  const speed = parseSpeed(options.speed ?? options.rate);
  const pauses: TtsPauseOptions = {
    pauseCommaMs: clampNumber(options.pauseCommaMs, 0, 1500, DEFAULT_PAUSES.pauseCommaMs),
    pauseSentenceMs: clampNumber(options.pauseSentenceMs, 0, 3000, DEFAULT_PAUSES.pauseSentenceMs),
    pauseParagraphMs: clampNumber(options.pauseParagraphMs, 0, 5000, DEFAULT_PAUSES.pauseParagraphMs),
  };

  const chunks = splitTextIntoChunks(text, 2000);
  const tmpBase = tmpdir();
  const wavPaths: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const outWav = path.join(tmpBase, `tts_chunk_${Date.now()}_${process.pid}_${i}.wav`);
      const units = splitIntoSpeechUnits(chunks[i], pauses);
      await generateChunkWav(units, voice, outWav, tmpBase, i, speed);
      wavPaths.push(outWav);
    }

    if (wavPaths.length === 1) {
      const outMp3 = path.join(tmpBase, `tts_single_${Date.now()}_${process.pid}.mp3`);
      try {
        await execAsync(
          `"${FFMPEG}" -hide_banner -loglevel error -i "${wavPaths[0]}" -codec:a libmp3lame -qscale:a 2 -y "${outMp3}"`,
          { timeout: 5 * 60 * 1000 },
        );
        const buf = await fs.readFile(outMp3);
        return buf;
      } finally {
        await fs.unlink(wavPaths[0]).catch(() => {});
        await fs.unlink(outMp3).catch(() => {});
      }
    }

    const outMp3Merged = path.join(tmpBase, `tts_merged_${Date.now()}_${process.pid}.mp3`);
    try {
      await concatenateWavsToMp3(wavPaths, outMp3Merged, tmpBase);
      const buf = await fs.readFile(outMp3Merged);
      return buf;
    } finally {
      await fs.unlink(outMp3Merged).catch(() => {});
    }
  } catch (error) {
    await Promise.all(wavPaths.map((p) => fs.unlink(p).catch(() => {})));
    throw error;
  }
}

export function getVoiceSamplePhrase(voiceId: string): string {
  if (voiceId === "pt-BR-AntonioNeural" || voiceId === "pm_alex" || voiceId === "pm_santa") {
    return "Olá! Sou o Antônio.";
  }
  return "Olá! Sou a Francisca.";
}

export async function getCachedVoiceSample(cacheDir: string, voiceId: string): Promise<Buffer> {
  await fs.mkdir(cacheDir, { recursive: true });
  const safeId = voiceId.replace(/[^\w-]/g, "");
  const samplePath = path.join(cacheDir, `${safeId}.mp3`);
  try {
    return await fs.readFile(samplePath);
  } catch {
    const text = getVoiceSamplePhrase(voiceId);
    const buffer = await synthesizeTtsBuffer({
      text,
      voiceId,
      speed: 1,
      pauseCommaMs: 0,
      pauseSentenceMs: 0,
      pauseParagraphMs: 0,
    });
    await fs.writeFile(samplePath, buffer).catch(() => {});
    return buffer;
  }
}

export async function warmupVoiceSamples(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
}

export async function generateTts(outputPath: string, options: TtsOptions): Promise<void> {
  const buffer = await synthesizeTtsBuffer(options);
  await fs.writeFile(outputPath, buffer);
}
