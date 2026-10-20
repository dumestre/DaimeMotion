import type { TranscriptSegment, TranscriptWord } from "../src/shared/types.js";

export function toSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const totalMs = Math.round(clamped * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((segment, index) => `${index + 1}\n${toSrtTimestamp(segment.start)} --> ${toSrtTimestamp(segment.end)}\n${segment.text}\n`)
    .join("\n");
}

interface WhisperJsonSegment {
  start?: number;
  end?: number;
  text?: string;
  offsets?: { from?: number; to?: number };
  tokens?: WhisperJsonWord[];
  words?: WhisperJsonWord[];
}

interface WhisperJsonWord {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
  offsets?: { from?: number; to?: number };
}

function segmentTimes(segment: WhisperJsonSegment): { start: number; end: number } {
  if (typeof segment.offsets?.from === "number" && typeof segment.offsets?.to === "number") {
    return { start: segment.offsets.from / 1000, end: segment.offsets.to / 1000 };
  }
  return {
    start: typeof segment.start === "number" ? segment.start : 0,
    end: typeof segment.end === "number" ? segment.end : 0,
  };
}

function wordTimes(word: WhisperJsonWord): { start: number; end: number } {
  if (typeof word.offsets?.from === "number" && typeof word.offsets?.to === "number") {
    return { start: word.offsets.from / 1000, end: word.offsets.to / 1000 };
  }
  return {
    start: typeof word.start === "number" ? word.start : 0,
    end: typeof word.end === "number" ? word.end : 0,
  };
}

export function parseWhisperJson(raw: string): { segments: TranscriptSegment[]; words: TranscriptWord[]; language: string } {
  const parsed: unknown = JSON.parse(raw);
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const result = record.result && typeof record.result === "object" ? (record.result as Record<string, unknown>) : {};
  const nested = result.result && typeof result.result === "object" ? (result.result as Record<string, unknown>) : {};
  const segmentsSource = [nested.segments, result.segments, record.transcription, record.segments]
    .find((candidate) => Array.isArray(candidate));
  const rawSegments = (segmentsSource as WhisperJsonSegment[] | undefined) ?? [];
  const segments: TranscriptSegment[] = rawSegments
    .map((segment) => {
      const { start, end } = segmentTimes(segment);
      return { start, end, text: (segment.text ?? "").trim() };
    })
    .filter((segment) => segment.text.length > 0);
  const words: TranscriptWord[] = [];
  for (const segment of rawSegments) {
    const segmentWords = Array.isArray(segment.words) ? segment.words : Array.isArray(segment.tokens) ? segment.tokens : [];
    for (const word of segmentWords) {
      const text = (word.word ?? word.text ?? "").trim();
      if (!text) continue;
      const { start, end } = wordTimes(word);
      words.push({ start, end, text });
    }
  }
  const languageCandidate = [result.language, nested.language, record.language].find(
    (candidate) => typeof candidate === "string",
  );
  const language = typeof languageCandidate === "string" ? languageCandidate : "auto";
  return { segments, words, language };
}
