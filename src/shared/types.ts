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

export interface ToolStatus {
  name: "OpenCode" | "HyperFrames" | "FFmpeg";
  available: boolean;
  version: string | null;
  installHint: string;
}

export interface TaskSnapshot {
  id: string;
  projectId: string;
  kind: "agent" | "render";
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
