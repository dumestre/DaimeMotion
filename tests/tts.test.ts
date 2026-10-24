import { describe, expect, it } from "vitest";
import { ptBrVoices } from "../server/tts.js";

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
});
