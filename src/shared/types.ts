export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface Project {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  resolution: string;
  frameRate: number;
  createdAt: string;
  updatedAt: string;
  directory: string;
}

export interface ProjectFile {
  name: string;
  path: string;
  kind: "audio" | "image" | "video" | "font" | "composition" | "other";
  size: number;
  duration: number | null;
}

export interface ApprovedReference {
  id: string;
  name: string;
  kind: "audio" | "image" | "video";
  purpose: "visual" | "music" | "video";
  notes: string;
  size: number;
  createdAt: string;
  url: string;
}

export interface ToolStatus {
  name: "OpenCode" | "HyperFrames" | "FFmpeg" | "whisper.cpp" | "whisper" | "auto-editor";
  available: boolean;
  version: string | null;
  installHint: string;
}

export type TranscriptionEngine = "whisper-cpp" | "whisper-python";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  source: string;
  language: string;
  model: string;
  generatedAt: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  text: string;
}

export interface TranscriptSummary {
  source: string;
  transcriptPath: string;
  srtPath: string;
  language: string;
  segments: number;
  text: string;
}

export interface TaskSnapshot {
  id: string;
  projectId: string;
  kind: "agent" | "render" | "transcribe" | "auto-edit";
  status: "running" | "completed" | "failed" | "cancelled";
  output: string[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  resolution: string;
  frameRate: number;
  style: string;
}

export interface ApiError {
  error: string;
}

export interface TtsVoice {
  id: string;
  name: string;
  gender: "feminino" | "masculino";
}

export interface TtsGenerateResult {
  name: string;
  path: string;
  size: number;
  voice: string;
}

