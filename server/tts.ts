import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);
import { tmpdir } from "node:os";

export interface TtsVoice { id: string; name: string; gender: "feminino" | "masculino"; }

export const ptBrVoices: TtsVoice[] = [
  { id: "pf_dora", name: "Dora", gender: "feminino" },
  { id: "pm_alex", name: "Alex", gender: "masculino" },
  { id: "pm_santa", name: "Santa", gender: "masculino" },
];

const defaultVoiceId = "pt-BR-FranciscaNeural";

export interface TtsOptions { text: string; voiceId?: string; rate?: string; pitch?: string; volume?: string; }

export function splitTextIntoChunks(text: string, maxChunkSize = 2500): string[] {
  if (text.length <= maxChunkSize) return [text];
  return [text];
}

const PYTHON = "C:\\Users\\DJDUM\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";

export async function synthesizeTtsBuffer(options: TtsOptions): Promise<Buffer> {
  const voice = (options.voiceId && ptBrVoices.some((v) => v.id === options.voiceId))
    ? options.voiceId
    : "pf_dora";
  const outPath = `${tmpdir().replace(/\\/g, "/")}/tts-${Date.now()}.wav`;
  const text = options.text.replace(/"/g, '\\"');
  const py = `from kokoro import KPipeline\nimport soundfile as sf\npipeline = KPipeline(lang_code="p")\ngenerator = pipeline("""${text}""", voice="${voice}")\nfor gs, ps, audio in generator:\n    sf.write("${outPath}", audio, 24000)\nprint("done")\n`;
  const scriptPath = `${tmpdir().replace(/\\/g, "/")}/tts_script_${Date.now()}.py`;
  await fs.writeFile(scriptPath, py);

  await execAsync(`"${PYTHON}" "${scriptPath}"`);

  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath).catch(() => {});
  await fs.unlink(scriptPath).catch(() => {});
  return buf;
}

export function getVoiceSamplePhrase(voiceId: string): string {
  return "Ol�! Sou uma voz de narra��o.";
}

export async function getCachedVoiceSample(cacheDir: string, voiceId: string): Promise<Buffer> {
  await fs.mkdir(cacheDir, { recursive: true });
  const safeId = voiceId.replace(/[^\w-]/g, "");
  const samplePath = `${cacheDir}/${safeId}.mp3`;
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
