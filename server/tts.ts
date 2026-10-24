import { promises as fs } from "node:fs";
import { EdgeTTS } from "edge-tts-universal";

/** Vozes disponíveis em português brasileiro */
export interface TtsVoice {
  id: string;
  name: string;
  gender: "feminino" | "masculino";
}

export const ptBrVoices: TtsVoice[] = [
  { id: "pt-BR-FranciscaNeural", name: "Francisca", gender: "feminino" },
  { id: "pt-BR-AntonioNeural", name: "Antônio", gender: "masculino" },
  { id: "pt-BR-BrendaNeural", name: "Brenda", gender: "feminino" },
  { id: "pt-BR-DonatoNeural", name: "Donato", gender: "masculino" },
  { id: "pt-BR-ElzaNeural", name: "Elza", gender: "feminino" },
  { id: "pt-BR-FabioNeural", name: "Fábio", gender: "masculino" },
  { id: "pt-BR-GiovannaNeural", name: "Giovanna", gender: "feminino" },
  { id: "pt-BR-HumbertoNeural", name: "Humberto", gender: "masculino" },
  { id: "pt-BR-LeticiaNeural", name: "Letícia", gender: "feminino" },
  { id: "pt-BR-ManuelaNeural", name: "Manuela", gender: "feminino" },
  { id: "pt-BR-NicolauNeural", name: "Nicolau", gender: "masculino" },
  { id: "pt-BR-ThalitaNeural", name: "Thalita", gender: "feminino" },
  { id: "pt-BR-ValerioNeural", name: "Valério", gender: "masculino" },
];

const defaultVoiceId = "pt-BR-FranciscaNeural";

/** Opções para geração de áudio TTS */
export interface TtsOptions {
  text: string;
  voiceId?: string;
  /** Ajuste de velocidade: ex. "+20%", "-10%", "+0%" */
  rate?: string;
  /** Ajuste de tom: ex. "+5Hz", "-3Hz", "+0Hz" */
  pitch?: string;
  /** Ajuste de volume: ex. "+10%", "-5%", "+0%" */
  volume?: string;
}

/**
 * Sintetiza áudio de fala em memória e retorna o Buffer MP3.
 */
export async function synthesizeTtsBuffer(options: TtsOptions): Promise<Buffer> {
  const voiceId = options.voiceId && ptBrVoices.some((v) => v.id === options.voiceId)
    ? options.voiceId
    : defaultVoiceId;

  const tts = new EdgeTTS(options.text, voiceId, {
    rate: options.rate || "+0%",
    volume: options.volume || "+0%",
    pitch: options.pitch || "+0Hz",
  });

  const result = await tts.synthesize();
  const arrayBuffer = await result.audio.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Retorna uma frase de amostra curta e direta para prévia em tempo real.
 */
export function getVoiceSamplePhrase(voiceId: string): string {
  const voice = ptBrVoices.find((v) => v.id === voiceId);
  if (!voice) return "Olá! Sou uma voz de narração.";
  const artigo = voice.gender === "feminino" ? "a" : "o";
  return `Olá! Sou ${artigo} ${voice.name}.`;
}

/**
 * Obtém ou gera em cache uma amostra de áudio pré-gravada em MP3 para a voz selecionada.
 * Resposta instantânea (0ms) se já estiver no cache.
 */
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

/**
 * Pré-carrega em background as amostras em MP3 de todas as vozes para que o preview seja instantâneo.
 */
export async function warmupVoiceSamples(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  for (const voice of ptBrVoices) {
    const safeId = voice.id.replace(/[^\w-]/g, "");
    const samplePath = `${cacheDir}/${safeId}.mp3`;
    try {
      await fs.access(samplePath);
    } catch {
      try {
        const text = getVoiceSamplePhrase(voice.id);
        const buffer = await synthesizeTtsBuffer({ text, voiceId: voice.id, rate: "+0%" });
        await fs.writeFile(samplePath, buffer);
      } catch {
        // Ignora erros individuais de aquecimento
      }
    }
  }
}

/**
 * Gera áudio de fala a partir de texto usando o Microsoft Edge TTS.
 * Salva o resultado como arquivo MP3 no caminho especificado.
 */
export async function generateTts(outputPath: string, options: TtsOptions): Promise<void> {
  const buffer = await synthesizeTtsBuffer(options);
  await fs.writeFile(outputPath, buffer);
}


