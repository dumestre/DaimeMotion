import { describe, expect, it } from "vitest";
import { parseWhisperJson, segmentsToSrt, toSrtTimestamp } from "../server/transcription";

describe("whisper transcription helpers", () => {
  it("formats SRT timestamps with milliseconds and zero padding", () => {
    expect(toSrtTimestamp(0)).toBe("00:00:00,000");
    expect(toSrtTimestamp(1.5)).toBe("00:00:01,500");
    expect(toSrtTimestamp(3661.007)).toBe("01:01:01,007");
    expect(toSrtTimestamp(-3)).toBe("00:00:00,000");
  });

  it("renders numbered SRT cues separated by blank lines", () => {
    const srt = segmentsToSrt([
      { start: 0, end: 1.2, text: "Olá mundo" },
      { start: 1.2, end: 3, text: "Segunda fala" },
    ]);
    const cues = srt.trim().split(/\n\n/);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toBe("1\n00:00:00,000 --> 00:00:01,200\nOlá mundo");
    expect(cues[1]).toBe("2\n00:00:01,200 --> 00:00:03,000\nSegunda fala");
  });

  it("parses whisper.cpp JSON using millisecond offsets and token timestamps", () => {
    const raw = JSON.stringify({
      result: { language: "pt" },
      transcription: [
        {
          offsets: { from: 0, to: 1500 },
          text: " Olá mundo",
          tokens: [
            { text: " Olá", offsets: { from: 0, to: 700 } },
            { text: " mundo", offsets: { from: 700, to: 1500 } },
          ],
        },
      ],
    });
    const parsed = parseWhisperJson(raw);
    expect(parsed.language).toBe("pt");
    expect(parsed.segments).toEqual([{ start: 0, end: 1.5, text: "Olá mundo" }]);
    expect(parsed.words).toEqual([
      { start: 0, end: 0.7, text: "Olá" },
      { start: 0.7, end: 1.5, text: "mundo" },
    ]);
  });

  it("falls back to seconds-based segments when offsets are absent", () => {
    const raw = JSON.stringify({
      result: { language: "en" },
      transcription: [{ start: 0, end: 2, text: "Hello " }, { start: 2, end: 4, text: "" }],
    });
    const parsed = parseWhisperJson(raw);
    expect(parsed.language).toBe("en");
    expect(parsed.segments).toEqual([{ start: 0, end: 2, text: "Hello" }]);
    expect(parsed.words).toEqual([]);
  });

  it("defaults the language to auto when absent", () => {
    const parsed = parseWhisperJson(JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1000 }, text: "hi" }] }));
    expect(parsed.language).toBe("auto");
  });
});
