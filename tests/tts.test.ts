import { describe, expect, it } from "vitest";
import {
  getVoiceSamplePhrase,
  normalizeTextForTts,
  parseSpeed,
  ptBrVoices,
  splitIntoSpeechUnits,
  splitTextIntoChunks,
} from "../server/tts.js";

describe("TTS Engine & Voices", () => {
  it("contém lista de vozes em português brasileiro", () => {
    expect(ptBrVoices.length).toBeGreaterThan(0);
    const dora = ptBrVoices.find((v) => v.id === "pf_dora");
    expect(dora).toBeDefined();
    expect(dora?.gender).toBe("feminino");

    const alex = ptBrVoices.find((v) => v.id === "pm_alex");
    expect(alex).toBeDefined();
    expect(alex?.gender).toBe("masculino");
  });

  it("todas as vozes possuem formato válido", () => {
    for (const voice of ptBrVoices) {
      expect(voice.id.length).toBeGreaterThan(0);
      expect(voice.name.length).toBeGreaterThan(0);
      expect(["feminino", "masculino"]).toContain(voice.gender);
    }
  });

  it("gera frase curta de amostra por voz", () => {
    const fSample = getVoiceSamplePhrase("pf_dora");
    expect(fSample).toBe("Olá! Sou a Francisca.");

    const aSample = getVoiceSamplePhrase("pm_alex");
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

describe("Normalização do texto para o TTS", () => {
  it("preserva acentos (fundamentais para a pronúncia)", () => {
    const text = "Não é fácil: você viu o avô e a avó no café da manhã?";
    expect(normalizeTextForTts(text)).toBe(text);
  });

  it("mantém os acentos em NFC e não remove diacríticos", () => {
    const decomposed = "na\u0303o, voce\u0302 e cafe\u0301";
    const normalized = normalizeTextForTts(decomposed);
    expect(normalized).toContain("não");
    expect(normalized).toContain("você");
    expect(normalized).toContain("café");
    expect(normalized).not.toContain("\u0303");
  });

  it("remove markdown mas mantém o texto falado", () => {
    const markdown = [
      "# Cena 01",
      "",
      "## Introdução",
      "",
      "O fascismo **valoriza** a unidade compulsória.",
      "",
      "---",
      "",
      "- Primeiro item",
      "- Segundo item",
      "",
      "## Observações de produção",
      "",
      "Usar voz feminina e trilha épica.",
    ].join("\n");

    const result = normalizeTextForTts(markdown);
    expect(result).not.toContain("#");
    expect(result).not.toContain("---");
    expect(result).not.toContain("**");
    expect(result).not.toContain("Observações de produção");
    expect(result).not.toContain("trilha épica");
    expect(result).toContain("O fascismo valoriza a unidade compulsória.");
    expect(result).toContain("Primeiro item");
  });

  it("converte aspas curvas e travessões", () => {
    const result = normalizeTextForTts("Ele disse “olá” — e saiu.");
    expect(result).toContain('"olá"');
    expect(result).not.toContain("—");
    expect(result).toContain("e saiu.");
  });

  it("repara texto corrompido por codificação (cp1252 -> UTF-8)", () => {
    const broken = "O fascismo n\u00c3\u00a3o \u00c3\u00a9 uma ideologia.";
    expect(normalizeTextForTts(broken)).toBe("O fascismo não é uma ideologia.");
  });

  it("limita quebras de linha a duas", () => {
    expect(normalizeTextForTts("Um.\n\n\n\nDois.")).toBe("Um.\n\nDois.");
  });

  it("corta a seção de observações mesmo sem cabeçalho markdown", () => {
    const text = "Texto falado.\n\nObservacoes de producao\n\n- usar voz feminina\n- trilha épica";
    expect(normalizeTextForTts(text)).toBe("Texto falado.");
  });
});

describe("Pausas entre trechos da narração", () => {
  const pauses = { pauseCommaMs: 120, pauseSentenceMs: 350, pauseParagraphMs: 700 };

  it("divide frases e aplica a pausa de ponto", () => {
    const units = splitIntoSpeechUnits("Primeira frase. Segunda frase.", {
      ...pauses,
      pauseCommaMs: 0,
    });
    expect(units.map((unit) => unit.text)).toEqual(["Primeira frase.", "Segunda frase."]);
    expect(units[0].gapMs).toBe(350);
    expect(units[1].gapMs).toBe(700);
  });

  it("divide cláusulas na vírgula quando a pausa é maior que zero", () => {
    const units = splitIntoSpeechUnits("Eu vim, eu vi, eu venci.", pauses);
    expect(units.map((unit) => unit.text)).toEqual(["Eu vim,", "eu vi,", "eu venci."]);
    expect(units[0].gapMs).toBe(120);
    expect(units[1].gapMs).toBe(120);
  });

  it("não divide cláusulas quando a pausa de vírgula é zero", () => {
    const units = splitIntoSpeechUnits("Eu vim, eu vi, eu venci.", {
      ...pauses,
      pauseCommaMs: 0,
    });
    expect(units).toHaveLength(1);
    expect(units[0].text).toBe("Eu vim, eu vi, eu venci.");
  });

  it("aplica a pausa de parágrafo entre parágrafos", () => {
    const units = splitIntoSpeechUnits("Parágrafo um.\n\nParágrafo dois.", pauses);
    expect(units[0].gapMs).toBe(700);
  });

  it("não quebra frase em abreviações", () => {
    const units = splitIntoSpeechUnits("O Dr. Silva chegou. Ele estava bem.", pauses);
    expect(units[0].text).toContain("Dr. Silva");
  });

  it("mantém o texto inteiro quando todas as pausas são zero", () => {
    const text = "Uma frase. Outra frase, com vírgula.\n\nNovo parágrafo.";
    const units = splitIntoSpeechUnits(text, {
      pauseCommaMs: 0,
      pauseSentenceMs: 0,
      pauseParagraphMs: 0,
    });
    expect(units).toHaveLength(1);
    expect(units[0].gapMs).toBe(0);
  });
});

describe("Velocidade da fala", () => {
  it("converte porcentagem antiga para fator do Kokoro", () => {
    expect(parseSpeed("+15%")).toBeCloseTo(1.15);
    expect(parseSpeed("-30%")).toBeCloseTo(0.7);
    expect(parseSpeed("+0%")).toBe(1);
  });

  it("aceita número direto", () => {
    expect(parseSpeed(1.2)).toBeCloseTo(1.2);
    expect(parseSpeed("0.9")).toBeCloseTo(0.9);
  });

  it("limita a faixa aceita e usa 1 como padrão", () => {
    expect(parseSpeed(5)).toBe(2);
    expect(parseSpeed(0.1)).toBe(0.5);
    expect(parseSpeed(undefined)).toBe(1);
  });
});
