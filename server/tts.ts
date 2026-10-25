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

export interface TtsOptions {
  text: string;
  voiceId?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

function normalizeVoiceId(voiceId?: string): string {
  if (voiceId && ptBrVoices.some((v) => v.id === voiceId)) {
    return voiceId;
  }
  return "pf_dora";
}

function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;:])\s+/);
  return sentences.filter((s) => s.trim().length > 0);
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

async function generateChunkWav(
  text: string,
  voice: string,
  outWavPath: string,
  tmpBase: string,
  index: number,
): Promise<void> {
  const textFile = path.join(tmpBase, `tts_text_${Date.now()}_${process.pid}_${index}.txt`);
  const scriptFile = path.join(tmpBase, `tts_chunk_${Date.now()}_${process.pid}_${index}.py`);

  await fs.writeFile(textFile, text, "utf8");

  const py = `from kokoro import KPipeline
import soundfile as sf

text_path = r"""${textFile.replace(/\\/g, "\\\\")}"""
out_path = r"""${outWavPath.replace(/\\/g, "\\\\")}"""
voice = "${voice}"

with open(text_path, "r", encoding="utf-8") as f:
    text = f.read()

pipeline = KPipeline(lang_code="p")
generator = pipeline(text, voice=voice)
for gs, ps, audio in generator:
    sf.write(out_path, audio, 24000)
    break
print("done")
`;

  await fs.writeFile(scriptFile, py, "utf8");

  try {
    await execAsync(`"${PYTHON}" "${scriptFile}"`, { timeout: 10 * 60 * 1000 });
  } finally {
    await fs.unlink(textFile).catch(() => {});
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
      `"${FFMPEG}" -hide_banner -loglevel error -f concat -safe 0 -i "${concatListPath}" -ar 24000 -ac 1 -c:a pcm_s16le -y "${mergedWavPath}"`,
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
  const text = options.text || "";
  if (!text.trim()) {
    throw new Error("Texto vazio para síntese de voz.");
  }

  const chunks = splitTextIntoChunks(text, 2000);
  const tmpBase = tmpdir();
  const wavPaths: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const outWav = path.join(tmpBase, `tts_chunk_${Date.now()}_${process.pid}_${i}.wav`);
      await generateChunkWav(chunks[i], voice, outWav, tmpBase, i);
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
    const buffer = await synthesizeTtsBuffer({ text, voiceId, rate: "+0%" });
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
