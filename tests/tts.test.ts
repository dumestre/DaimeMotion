import { describe, expect, it } from "vitest";
import { getVoiceSamplePhrase, ptBrVoices, splitTextIntoChunks } from "../server/tts.js";

describe("TTS Engine & Voices", () => {
  it("contém lista de vozes em português brasileiro", () => {
    expect(ptBrVoices.length).toBeGreaterThan(0);
    const francisca = ptBrVoices.find((v) => v.id === "pt-BR-FranciscaNeural");
    expect(francisca).toBeDefined();
    expect(francisca?.gender).toBe("feminino");

    const antonio = ptBrVoices.find((v) => v.id === "pt-BR-AntonioNeural");
    expect(antonio).toBeDefined();
    expect(antonio?.gender).toBe("masculino");
  });

  it("todas as vozes possuem formato válido pt-BR", () => {
    for (const voice of ptBrVoices) {
      expect(voice.id).toMatch(/^pt-BR-/);
      expect(voice.name.length).toBeGreaterThan(0);
      expect(["feminino", "masculino"]).toContain(voice.gender);
    }
  });

  it("gera frase curta de amostra por voz", () => {
    const fSample = getVoiceSamplePhrase("pt-BR-FranciscaNeural");
    expect(fSample).toBe("Olá! Sou a Francisca.");

    const aSample = getVoiceSamplePhrase("pt-BR-AntonioNeural");
    expect(aSample).toBe("Olá! Sou o Antônio.");
  });

  it("divide textos longos em pedaços sem estourar limites", () => {
    const shortText = "Este é um texto curto.";
    expect(splitTextIntoChunks(shortText, 100)).toEqual([shortText]);

    const longParagraphs = [
      "Primeiro parágrafo de teste sobre o vídeo.",
      "Segundo parágrafo detalhando o roteiro da narração.",
      "Terceiro parágrafo explicando as regras de edição.",
    ].join("\n\n");

    const chunks = splitTextIntoChunks(longParagraphs, 60);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(60);
    }
  });
});

