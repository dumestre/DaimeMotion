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
 * Gera áudio de fala a partir de texto usando o Microsoft Edge TTS.
 * Salva o resultado como arquivo MP3 no caminho especificado.
 */
export async function generateTts(outputPath: string, options: TtsOptions): Promise<void> {
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
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}
