import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type {
  AspectRatio,
  ApprovedReference,
  Project,
  ProjectFile,
  ProjectTemplate,
  TaskSnapshot,
  ToolStatus,
  Transcript,
  TranscriptSegment,
  TranscriptSummary,
  TranscriptWord,
} from "../src/shared/types.js";
import { PathSafetyError, resolveWithinDirectory, sanitizeFilename as safeFilename } from "./path-safety.js";
import { installProjectGuidance } from "./project-guidance.js";
import { isTemplateId, seedProjectComposition, type TemplateId } from "./templates.js";
import { parseWhisperJson, segmentsToSrt } from "./transcription.js";

const port = Number(process.env.DAIME_PORT ?? 4317);
const projectRoot = path.resolve(process.cwd());
const dataRoot = path.join(projectRoot, "data");
const projectsRoot = path.join(dataRoot, "projects");
const referencesRoot = path.join(dataRoot, "references");
const uploadsRoot = path.join(dataRoot, "uploads");
const projectIndexPath = path.join(dataRoot, "projects.json");
const referencesIndexPath = path.join(dataRoot, "references.json");
const applicationRoot = path.resolve(process.cwd());
const app = express();
const tasks = new Map<string, { snapshot: TaskSnapshot; child: ChildProcess }>();
const playbacks = new Map<string, { child: ChildProcess; port: number }>();
const templates: ProjectTemplate[] = [
  {
    id: "music-video",
    name: "Videoclipe",
    description: "Composição ritmada para música e performance.",
    aspectRatio: "16:9",
    resolution: "landscape",
    frameRate: 30,
    style: "Tipografia expressiva, cortes rítmicos e movimento de câmera.",
  },
  {
    id: "vertical-social",
    name: "Social vertical",
    description: "Vídeo vertical para redes sociais.",
    aspectRatio: "9:16",
    resolution: "portrait",
    frameRate: 30,
    style: "Composição vertical, leitura rápida e contraste forte.",
  },
  {
    id: "square-promo",
    name: "Promo quadrado",
    description: "Peça promocional quadrada.",
    aspectRatio: "1:1",
    resolution: "square",
    frameRate: 30,
    style: "Hierarquia clara, enquadramento central e contraste forte.",
  },
  {
    id: "music-video-3d",
    name: "Videoclipe 3D",
    description: "Composição 3D com malha wireframe e câmera animada.",
    aspectRatio: "16:9",
    resolution: "landscape",
    frameRate: 30,
    style: "Sólido 3D orbitando, wireframe e profundidade de câmera.",
  },
  {
    id: "vertical-social-3d",
    name: "Social vertical 3D",
    description: "Vídeo vertical com cena tridimensional.",
    aspectRatio: "9:16",
    resolution: "portrait",
    frameRate: 30,
    style: "Objeto 3D central, leitura rápida e contraste forte.",
  },
  {
    id: "square-promo-3d",
    name: "Promo quadrado 3D",
    description: "Peça promocional quadrada com volume 3D.",
    aspectRatio: "1:1",
    resolution: "square",
    frameRate: 30,
    style: "Volume tridimensional centralizado e enquadramento simétrico.",
  },
];

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function assertInside(parent: string, candidate: string): string {
  try {
    return resolveWithinDirectory(parent, candidate);
  } catch (error) {
    if (error instanceof PathSafetyError) throw new HttpError(400, error.message);
    throw error;
  }
}

function safeProjectDirectory(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Identificador de projeto inválido.");
  }
  return assertInside(projectsRoot, path.join(projectsRoot, id));
}

function routeId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== "string") throw new HttpError(400, "Identificador da solicitação inválido.");
  return id;
}

async function readProjects(): Promise<Project[]> {
  try {
    const contents = await fs.readFile(projectIndexPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (!Array.isArray(parsed)) throw new Error("O arquivo de projetos não contém uma lista.");
    return parsed as Project[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new HttpError(500, `Não foi possível ler a biblioteca de projetos: ${(error as Error).message}`);
  }
}

async function writeProjects(projects: Project[]): Promise<void> {
  const temporaryPath = `${projectIndexPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(projects, null, 2), "utf8");
  await fs.rename(temporaryPath, projectIndexPath);
}

async function readApprovedReferences(): Promise<ApprovedReference[]> {
  try {
    const contents = await fs.readFile(referencesIndexPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (!Array.isArray(parsed)) throw new Error("O arquivo de referências não contém uma lista.");
    return parsed as ApprovedReference[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new HttpError(500, `Não foi possível ler a biblioteca de referências: ${(error as Error).message}`);
  }
}

async function writeApprovedReferences(references: ApprovedReference[]): Promise<void> {
  const temporaryPath = `${referencesIndexPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(references, null, 2), "utf8");
  await fs.rename(temporaryPath, referencesIndexPath);
}

async function getProject(id: string): Promise<Project> {
  const project = (await readProjects()).find((item) => item.id === id);
  if (!project) throw new HttpError(404, "Projeto não encontrado.");
  return project;
}

function resolveCli(name: string): { command: string; prefixArgs: string[] } | null {
  if (name === "hyperframes") {
    const bundledCli = path.join(applicationRoot, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
    if (existsSync(bundledCli)) return { command: process.execPath, prefixArgs: [bundledCli] };
  }
  if (process.platform !== "win32") {
    const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
    for (const entry of pathEntries) {
      const candidate = path.join(entry, name);
      if (existsSync(candidate)) return { command: candidate, prefixArgs: [] };
    }
    return null;
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
  const powerShell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  for (const entry of pathEntries) {
    for (const extension of [".exe", ".ps1", ".cmd"]) {
      const candidate = path.join(entry, `${name}${extension}`);
      if (!existsSync(candidate)) continue;
      if (extension === ".ps1") {
        return {
          command: powerShell,
          prefixArgs: ["-NoProfile", "-NonInteractive", "-File", candidate],
        };
      }
      if (extension === ".cmd") continue;
      return { command: candidate, prefixArgs: [] };
    }
  }
  return null;
}

function cliArguments(name: string, args: string[]): { command: string; args: string[] } {
  const resolved = resolveCli(name);
  if (!resolved) {
    const help =
      name === "opencode"
        ? "Instale e configure o OpenCode para enviar instruções."
        : name === "whisper-cli"
          ? "Instale o whisper.cpp e garanta que o whisper-cli esteja no PATH para transcrever áudios."
          : "Instale o HyperFrames CLI e o FFmpeg conforme a documentação oficial.";
    throw new HttpError(503, `${name} não foi encontrado. ${help}`);
  }
  return { command: resolved.command, args: [...resolved.prefixArgs, ...args] };
}

function runCapture(
  name: string,
  args: string[],
  cwd: string,
  timeoutMs = 30_000,
): Promise<{ code: number; output: string }> {
  const invocation = cliArguments(name, args);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new HttpError(504, `${name} excedeu o tempo limite.`));
      }
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-12_000);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-12_000);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new HttpError(503, `Não foi possível iniciar ${name}: ${error.message}`));
      }
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      resolve({ code: code ?? 1, output: output.trim() });
    });
  });
}

async function getToolStatus(
  name: ToolStatus["name"],
  command: string,
  args: string[],
  installHint: string,
): Promise<ToolStatus> {
  try {
    if (!resolveCli(command)) return { name, available: false, version: null, installHint };
    const result = await runCapture(command, args, dataRoot, 8_000);
    const version = result.output.split(/\r?\n/).find((line) => line.trim())?.trim() ?? null;
    return { name, available: result.code === 0, version, installHint };
  } catch (error) {
    return {
      name,
      available: false,
      version: null,
      installHint: error instanceof Error ? error.message : installHint,
    };
  }
}

function recordOutput(snapshot: TaskSnapshot, chunk: string, carry: { value: string }): void {
  carry.value += chunk;
  const lines = carry.value.split(/\r?\n/);
  carry.value = lines.pop() ?? "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    snapshot.output.push(line.slice(0, 4_000));
  }
  if (snapshot.output.length > 500) snapshot.output.splice(0, snapshot.output.length - 500);
}

function killProcessTree(child: ChildProcess): void {
  if (process.platform === "win32" && child.pid) {
    const taskkill = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const killer = spawn(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    killer.unref();
    return;
  }
  child.kill("SIGTERM");
}

async function listProjectFiles(projectDir: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  const ignored = new Set(["node_modules", ".git", ".hyperframes", ".cache"]);
  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > 7 || files.length >= 2_000) return;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, depth + 1);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolute);
        const extension = path.extname(entry.name).toLowerCase();
        const kind: ProjectFile["kind"] =
          [".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"].includes(extension)
            ? "audio"
            : [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension)
              ? "image"
              : [".mp4", ".mov", ".webm", ".mkv"].includes(extension)
                ? "video"
                : [".ttf", ".otf", ".woff", ".woff2"].includes(extension)
                  ? "font"
                  : [".html", ".css", ".js", ".ts"].includes(extension)
                    ? "composition"
                    : "other";
        files.push({
          name: entry.name,
          path: path.relative(projectDir, absolute).split(path.sep).join("/"),
          kind,
          size: stat.size,
          duration: (kind === "audio" || kind === "video")
            ? await probeMediaDuration(absolute, projectDir)
            : null,
        });
      }

      async function probeMediaDuration(filePath: string, projectDir: string): Promise<number | null> {
        if (!resolveCli("ffprobe")) return null;
        try {
          const result = await runCapture(
            "ffprobe",
            ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
            projectDir,
            10_000,
          );
          const duration = Number(result.output);
          return result.code === 0 && Number.isFinite(duration) && duration >= 0 ? duration : null;
        } catch {
          return null;
        }
      }
    }
  }
  await visit(projectDir, 0);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function validateProjectRequest(body: unknown): {
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  resolution: string;
  frameRate: number;
  templateId: TemplateId;
} {
  if (!body || typeof body !== "object") throw new HttpError(400, "Informe os dados do projeto.");
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const ratios: AspectRatio[] = ["16:9", "9:16", "1:1"];
  const aspectRatio = value.aspectRatio;
  const resolution = value.resolution;
  const frameRate = value.frameRate;
  const templateId = isTemplateId(value.templateId) ? value.templateId : "music-video";
  if (name.length < 1 || name.length > 80) throw new HttpError(400, "O nome deve ter entre 1 e 80 caracteres.");
  if (description.length > 500) throw new HttpError(400, "A descrição pode ter no máximo 500 caracteres.");
  if (typeof aspectRatio !== "string" || !ratios.includes(aspectRatio as AspectRatio)) {
    throw new HttpError(400, "Proporção de vídeo não suportada.");
  }
  const resolutionRatios: Record<string, AspectRatio> = {
    landscape: "16:9",
    "landscape-4k": "16:9",
    "landscape-720p": "16:9",
    "landscape-480p": "16:9",
    portrait: "9:16",
    "portrait-4k": "9:16",
    "portrait-720p": "9:16",
    "portrait-480p": "9:16",
    square: "1:1",
    "square-4k": "1:1",
    "square-720p": "1:1",
    "square-480p": "1:1",
  };
  if (typeof resolution !== "string" || resolutionRatios[resolution] !== aspectRatio) {
    throw new HttpError(400, "Escolha uma resolução HyperFrames compatível com a proporção.");
  }
  if (typeof frameRate !== "number" || ![24, 25, 30, 50, 60].includes(frameRate)) {
    throw new HttpError(400, "Taxa de quadros não suportada.");
  }
  return { name, description, aspectRatio: aspectRatio as AspectRatio, resolution, frameRate, templateId };
}

async function applyFrameRate(projectDir: string, frameRate: number): Promise<void> {
  const compositionPath = path.join(projectDir, "index.html");
  const html = await fs.readFile(compositionPath, "utf8");
  const rootElement = /<([a-z][\w:-]*)([^>]*\bdata-composition-id(?:\s*=\s*["'][^"']*["'])?[^>]*)>/i;
  const match = html.match(rootElement);
  if (!match) throw new HttpError(500, "A composição inicializada não contém um elemento HyperFrames data-composition-id.");
  const attributes = (match[2] ?? "")
    .replace(/\s+data-fps\s*=\s*["'][^"']*["']/i, "")
    .replace(/\s+$/, "");
  const openingTag = `<${match[1]}${attributes} data-fps="${frameRate}">`;
  await fs.writeFile(compositionPath, html.replace(rootElement, openingTag), "utf8");
}

function whisperModelPath(): string | null {
  const candidates = [
    process.env.DAIME_WHISPER_MODEL,
    path.join(dataRoot, "models", "ggml-base.bin"),
    path.join(dataRoot, "models", "ggml-small.bin"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function readWhisperOutput(jsonBase: string): Promise<{ segments: TranscriptSegment[]; words: TranscriptWord[]; language: string }> {
  let raw: string;
  try {
    raw = await fs.readFile(`${jsonBase}.json`, "utf8");
  } catch (error) {
    throw new HttpError(502, `O whisper.cpp não gerou o arquivo JSON esperado: ${(error as Error).message}`);
  }
  try {
    return parseWhisperJson(raw);
  } catch (error) {
    throw new HttpError(502, `Não foi possível interpretar a saída JSON do whisper.cpp: ${(error as Error).message}`);
  }
}

async function transcribeProjectMedia(project: Project, source: ProjectFile): Promise<TranscriptSummary> {
  if (source.kind !== "audio" && source.kind !== "video") {
    throw new HttpError(400, "Somente áudios e vídeos podem ser transcritos.");
  }
  const projectDir = safeProjectDirectory(project.id);
  const sourcePath = assertInside(projectDir, path.join(projectDir, source.path));
  const modelPath = whisperModelPath();
  if (!modelPath) {
    throw new HttpError(503, "Nenhum modelo do whisper.cpp foi encontrado. Coloque ggml-base.bin em data/models ou defina DAIME_WHISPER_MODEL.");
  }
  if (!resolveCli("whisper-cli")) {
    throw new HttpError(503, "whisper-cli não foi encontrado no PATH. Instale o whisper.cpp e adicione o binário ao PATH.");
  }
  const workDir = path.join(projectDir, ".daime-transcripts");
  await fs.mkdir(workDir, { recursive: true });
  const stem = path.basename(source.path, path.extname(source.path)).replace(/[^\w.-]+/g, "_").slice(0, 60) || "media";
  const base = path.join(workDir, `${stem}-${Date.now().toString(36)}`);
  const wavPath = `${base}.wav`;

  const ffmpeg = await runCapture(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath],
    projectDir,
    180_000,
  );
  if (ffmpeg.code !== 0) {
    throw new HttpError(502, `O FFmpeg falhou ao preparar o áudio para transcrição. Saída: ${ffmpeg.output || "sem detalhes"}`);
  }

  const whisper = await runCapture(
    "whisper-cli",
    ["-m", modelPath, "-f", wavPath, "-ojf", "-osrt", "-ml", "1", "-sow", "-of", base, "-np"],
    projectDir,
    900_000,
  );
  if (whisper.code !== 0) {
    await fs.rm(wavPath, { force: true }).catch(() => undefined);
    throw new HttpError(502, `O whisper.cpp falhou ao transcrever. Saída: ${whisper.output || "sem detalhes"}`);
  }

  const { segments, words, language } = await readWhisperOutput(base);
  if (segments.length === 0) {
    await fs.rm(wavPath, { force: true }).catch(() => undefined);
    throw new HttpError(422, "O whisper.cpp não reconheceu fala neste arquivo.");
  }

  const transcript: Transcript = {
    source: source.path,
    language,
    model: path.basename(modelPath),
    generatedAt: new Date().toISOString(),
    segments,
    words,
    text: segments.map((segment) => segment.text).join(" ").trim(),
  };

  const transcriptsDir = path.join(projectDir, "transcripts");
  await fs.mkdir(transcriptsDir, { recursive: true });
  const transcriptPath = assertInside(projectDir, path.join(transcriptsDir, `${stem}.json`));
  const srtPath = assertInside(projectDir, path.join(transcriptsDir, `${stem}.srt`));
  await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2), "utf8");
  await fs.writeFile(srtPath, segmentsToSrt(segments), "utf8");
  await fs.rm(wavPath, { force: true }).catch(() => undefined);

  const projects = await readProjects();
  const current = projects.find((item) => item.id === project.id);
  if (current) {
    current.updatedAt = new Date().toISOString();
    await writeProjects(projects);
  }

  return {
    source: source.path,
    transcriptPath: path.relative(projectDir, transcriptPath).split(path.sep).join("/"),
    srtPath: path.relative(projectDir, srtPath).split(path.sep).join("/"),
    language,
    segments: segments.length,
    text: transcript.text,
  };
}

async function startTask(
  project: Project,
  kind: TaskSnapshot["kind"],
  name: string,
  args: string[],
): Promise<TaskSnapshot> {
  const projectDir = safeProjectDirectory(project.id);
  const invocation = cliArguments(name, args);
  const snapshot: TaskSnapshot = {
    id: crypto.randomUUID(),
    projectId: project.id,
    kind,
    status: "running",
    output: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  const child = spawn(invocation.command, invocation.args, {
    cwd: projectDir,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const carry = { value: "" };
  tasks.set(snapshot.id, { snapshot, child });
  const onData = (chunk: Buffer) => recordOutput(snapshot, chunk.toString("utf8"), carry);
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.once("error", (error) => {
    snapshot.status = "failed";
    snapshot.error = `Não foi possível iniciar ${name}: ${error.message}`;
    snapshot.finishedAt = new Date().toISOString();
  });
  child.once("close", async (code) => {
    if (carry.value.trim()) snapshot.output.push(carry.value.trim().slice(0, 4_000));
    if (snapshot.status === "running") {
      snapshot.status = code === 0 ? "completed" : "failed";
      if (code !== 0) snapshot.error = `${name} terminou com código ${code ?? "desconhecido"}.`;
    }
    snapshot.finishedAt = new Date().toISOString();
    try {
      const projects = await readProjects();
      const current = projects.find((item) => item.id === project.id);
      if (current) {
        current.updatedAt = snapshot.finishedAt;
        await writeProjects(projects);
      }
    } catch (error) {
      snapshot.output.push(`Falha ao salvar a data de alteração: ${(error as Error).message}`);
    }
  });
  return snapshot;
}

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Não foi possível reservar uma porta local."));
        return;
      }
      const assignedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(assignedPort)));
    });
  });
}

function projectMiddleware(request: Request, _response: Response, next: NextFunction): void {
  getProject(routeId(request))
    .then(() => next())
    .catch(next);
}

const allowedMediaExtensions = new Set([
  ".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg",
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
  ".mp4", ".mov", ".webm", ".mkv",
  ".ttf", ".otf", ".woff", ".woff2",
]);
const upload = multer({
  dest: uploadsRoot,
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(path.basename(file.originalname)).toLowerCase();
    if (!allowedMediaExtensions.has(extension)) {
      callback(new HttpError(415, "Formato de mídia não permitido."));
      return;
    }
    callback(null, true);
  },
});
const referenceExtensions = new Set([
  ".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".mp4", ".mov", ".webm", ".mkv",
]);

function referenceKind(extension: string): ApprovedReference["kind"] {
  if ([".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"].includes(extension)) return "audio";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) return "image";
  return "video";
}

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_request, response, next) => {
  try {
    const tools = await Promise.all([
      getToolStatus("OpenCode", "opencode", ["--version"], "Instale o OpenCode e configure um provedor."),
      getToolStatus("HyperFrames", "hyperframes", ["--version"], "Instale o HyperFrames CLI pela documentação oficial."),
      getToolStatus("FFmpeg", "ffmpeg", ["-version"], "Instale o FFmpeg e adicione-o ao PATH."),
      getToolStatus("whisper.cpp", "whisper-cli", ["--help"], "Compile o whisper.cpp e adicione o whisper-cli ao PATH."),
    ]);
    response.json({ ok: true, dataDirectory: dataRoot, tools });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", async (_request, response, next) => {
  try {
    response.json(await readProjects());
  } catch (error) {
    next(error);
  }
});

app.get("/api/templates", (_request, response) => response.json(templates));

app.post("/api/projects", async (request, response, next) => {
  try {
    const input = validateProjectRequest(request.body);
    if (request.body?.allowGlobalSkills !== true) {
      throw new HttpError(400, "Confirme explicitamente a instalação global de skills do HyperFrames.");
    }
    const projects = await readProjects();
    const id = crypto.randomUUID();
    const projectDir = safeProjectDirectory(id);
    const result = await runCapture(
      "hyperframes",
      ["init", id, "--non-interactive", "--resolution", input.resolution],
      projectsRoot,
      120_000,
    );
    if (result.code !== 0) {
      throw new HttpError(500, `O HyperFrames não conseguiu inicializar o projeto. ${result.output}`);
    }
    await applyFrameRate(projectDir, input.frameRate);
    try {
      await seedProjectComposition(projectDir, {
        templateId: input.templateId,
        name: input.name,
        resolution: input.resolution,
        frameRate: input.frameRate,
      });
    } catch (error) {
      console.error(`Falha ao semear a composição do template ${input.templateId}: ${(error as Error).message}`);
    }
    const now = new Date().toISOString();
    const project: Project = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
      directory: projectDir,
    };
    await installProjectGuidance(
      projectDir,
      path.join(applicationRoot, "docs", "AI_VIDEO_PROJECT_WORKFLOW.md"),
      {
        aspectRatio: project.aspectRatio,
        resolution: project.resolution,
        frameRate: project.frameRate,
        description: project.description,
      },
    );
    await fs.writeFile(
      path.join(projectDir, ".daime-motion.json"),
      JSON.stringify(
        {
          id,
          name: project.name,
          description: project.description,
          aspectRatio: project.aspectRatio,
          resolution: project.resolution,
          frameRate: project.frameRate,
        },
        null,
        2,
      ),
      "utf8",
    );
    projects.unshift(project);
    await writeProjects(projects);
    response.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/duplicate", projectMiddleware, async (request, response, next) => {
  try {
    const source = await getProject(routeId(request));
    const projects = await readProjects();
    const id = crypto.randomUUID();
    const sourceDir = safeProjectDirectory(source.id);
    const newDir = safeProjectDirectory(id);
    await fs.cp(sourceDir, newDir, {
      recursive: true,
      filter: (sourcePath) => !sourcePath.split(path.sep).some((part) => ["node_modules", ".git", ".hyperframes", "exports"].includes(part)),
    });
    const now = new Date().toISOString();
    const duplicate: Project = {
      ...source,
      id,
      name: `${source.name} (cópia)`,
      createdAt: now,
      updatedAt: now,
      directory: newDir,
    };
    const metadataPath = path.join(newDir, ".daime-motion.json");
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          id,
          name: duplicate.name,
          description: duplicate.description,
          aspectRatio: duplicate.aspectRatio,
          resolution: duplicate.resolution,
          frameRate: duplicate.frameRate,
        },
        null,
        2,
      ),
      "utf8",
    );
    projects.unshift(duplicate);
    await writeProjects(projects);
    response.status(201).json(duplicate);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:id", async (request, response, next) => {
  try {
    if (request.body?.confirm !== true) throw new HttpError(400, "Confirme a exclusão do projeto.");
    const project = await getProject(routeId(request));
    if (tasks.size && [...tasks.values()].some(({ snapshot }) => snapshot.projectId === project.id && snapshot.status === "running")) {
      throw new HttpError(409, "Cancele a tarefa em andamento antes de excluir este projeto.");
    }
    const playback = playbacks.get(project.id);
    if (playback) {
      killProcessTree(playback.child);
      playbacks.delete(project.id);
    }
    const directory = safeProjectDirectory(project.id);
    await fs.rm(directory, { recursive: true, force: false });
    const projects = (await readProjects()).filter((item) => item.id !== project.id);
    await writeProjects(projects);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:id/files", projectMiddleware, async (request, response, next) => {
  try {
    response.json(await listProjectFiles(safeProjectDirectory(routeId(request))));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/projects/:id/assets",
  projectMiddleware,
  upload.single("file"),
  async (request, response, next) => {
    try {
      const file = request.file;
      if (!file) throw new HttpError(400, "Selecione um arquivo para importar.");
      const projectDir = safeProjectDirectory(routeId(request));
      const assetsDir = path.join(projectDir, "assets");
      await fs.mkdir(assetsDir, { recursive: true });
      const originalName = safeFilename(path.basename(file.originalname));
      const extension = path.extname(originalName).toLowerCase();
      const base = path.basename(originalName, extension) || "media";
      const targetName = `${base}-${crypto.randomUUID().slice(0, 8)}${extension}`;
      const targetPath = assertInside(assetsDir, path.join(assetsDir, targetName));
      await fs.rename(file.path, targetPath);
      const projects = await readProjects();
      const project = projects.find((item) => item.id === routeId(request));
      if (project) {
        project.updatedAt = new Date().toISOString();
        await writeProjects(projects);
      }
      response.status(201).json({
        name: targetName,
        path: `assets/${targetName}`,
        size: file.size,
      });
    } catch (error) {
      if (request.file) await fs.rm(request.file.path, { force: true }).catch(() => undefined);
      next(error);
    }
  },
);

app.get("/api/references", async (_request, response, next) => {
  try {
    response.json(await readApprovedReferences());
  } catch (error) {
    next(error);
  }
});

app.post("/api/references", upload.single("file"), async (request, response, next) => {
  const temporaryFile = request.file?.path;
  let storedPath: string | undefined;
  try {
    const file = request.file;
    if (!file) throw new HttpError(400, "Selecione um arquivo para aprovar como referência.");
    const originalName = safeFilename(path.basename(file.originalname));
    const extension = path.extname(originalName).toLowerCase();
    if (!referenceExtensions.has(extension)) {
      throw new HttpError(415, "Referências aceitam somente imagens, vídeos e áudios comuns; fontes e SVG não são aceitos.");
    }
    const purpose = request.body?.purpose;
    if (purpose !== "visual" && purpose !== "music" && purpose !== "video") {
      throw new HttpError(400, "Escolha a finalidade desta referência.");
    }
    const notes = typeof request.body?.notes === "string" ? request.body.notes.trim() : "";
    if (notes.length > 500) throw new HttpError(400, "As observações não podem exceder 500 caracteres.");

    await fs.mkdir(referencesRoot, { recursive: true });
    const id = crypto.randomUUID();
    storedPath = assertInside(referencesRoot, path.join(referencesRoot, `${id}${extension}`));
    await fs.rename(file.path, storedPath);
    const item: ApprovedReference = {
      id,
      name: originalName,
      kind: referenceKind(extension),
      purpose,
      notes,
      size: file.size,
      createdAt: new Date().toISOString(),
      url: `/api/references/${id}/file`,
    };
    await writeApprovedReferences([item, ...(await readApprovedReferences())]);
    response.status(201).json(item);
  } catch (error) {
    if (storedPath) await fs.rm(storedPath, { force: true }).catch(() => undefined);
    else if (temporaryFile) await fs.rm(temporaryFile, { force: true }).catch(() => undefined);
    next(error);
  }
});

app.get("/api/references/:id/file", async (request, response, next) => {
  try {
    const id = routeId(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new HttpError(400, "Identificador de referência inválido.");
    }
    const item = (await readApprovedReferences()).find((reference) => reference.id === id);
    if (!item) throw new HttpError(404, "Referência não encontrada.");
    const extension = path.extname(item.name).toLowerCase();
    if (!referenceExtensions.has(extension)) throw new HttpError(415, "Formato de referência não permitido.");
    const filePath = assertInside(referencesRoot, path.join(referencesRoot, `${id}${extension}`));
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.sendFile(filePath, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/references/:id", async (request, response, next) => {
  try {
    const id = routeId(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new HttpError(400, "Identificador de referência inválido.");
    }
    const references = await readApprovedReferences();
    const item = references.find((reference) => reference.id === id);
    if (!item) throw new HttpError(404, "Referência não encontrada.");
    await writeApprovedReferences(references.filter((reference) => reference.id !== id));
    const extension = path.extname(item.name).toLowerCase();
    if (referenceExtensions.has(extension)) {
      await fs.rm(assertInside(referencesRoot, path.join(referencesRoot, `${id}${extension}`)), { force: true });
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/agent", projectMiddleware, async (request, response, next) => {
  try {
    const prompt = typeof request.body?.prompt === "string" ? request.body.prompt.trim() : "";
    if (!prompt || prompt.length > 12_000) {
      throw new HttpError(400, "A instrução deve ter entre 1 e 12.000 caracteres.");
    }
    const project = await getProject(routeId(request));
    await installProjectGuidance(
      safeProjectDirectory(project.id),
      path.join(applicationRoot, "docs", "AI_VIDEO_PROJECT_WORKFLOW.md"),
      {
        aspectRatio: project.aspectRatio,
        resolution: project.resolution,
        frameRate: project.frameRate,
        description: project.description,
      },
    );
    const snapshot = await startTask(project, "agent", "opencode", [
      "run",
      "--format",
      "json",
      "--session",
      project.id,
      "--dir",
      safeProjectDirectory(project.id),
      prompt,
    ]);
    response.status(202).json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/:id", (request, response) => {
  const task = tasks.get(routeId(request));
  if (!task) {
    response.status(404).json({ error: "Tarefa não encontrada nesta execução do aplicativo." });
    return;
  }
  response.json(task.snapshot);
});

app.post("/api/tasks/:id/cancel", (request, response, next) => {
  const task = tasks.get(routeId(request));
  if (!task) {
    next(new HttpError(404, "Tarefa não encontrada."));
    return;
  }
  if (task.snapshot.status !== "running") {
    next(new HttpError(409, "A tarefa já foi encerrada."));
    return;
  }
  task.snapshot.status = "cancelled";
  task.snapshot.finishedAt = new Date().toISOString();
  task.snapshot.error = "Execução cancelada pelo usuário.";
  killProcessTree(task.child);
  response.json(task.snapshot);
});

app.post("/api/projects/:id/preview", projectMiddleware, async (request, response, next) => {
  try {
    const project = await getProject(routeId(request));
    const active = playbacks.get(project.id);
    if (active) {
      response.json({ url: `http://127.0.0.1:${active.port}` });
      return;
    }
    const playbackPort = await allocatePort();
    const projectDir = safeProjectDirectory(project.id);
    const invocation = cliArguments("hyperframes", [
      "play",
      "--port",
      String(playbackPort),
      "--no-open",
    ]);
    const child = spawn(invocation.command, invocation.args, {
      cwd: projectDir,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    playbacks.set(project.id, { child, port: playbackPort });
    const playbackOutput: string[] = [];
    let playbackError: string | null = null;
    const collectPlaybackOutput = (chunk: Buffer) => {
      playbackOutput.push(...chunk.toString("utf8").split(/\r?\n/).filter(Boolean));
      if (playbackOutput.length > 40) playbackOutput.splice(0, playbackOutput.length - 40);
    };
    child.stdout?.on("data", collectPlaybackOutput);
    child.stderr?.on("data", collectPlaybackOutput);
    child.once("close", () => {
      if (playbacks.get(project.id)?.child === child) playbacks.delete(project.id);
    });
    child.once("error", (error) => {
      playbackError = error.message;
      playbacks.delete(project.id);
    });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (child.exitCode !== null || child.signalCode !== null || playbackError) break;
      try {
        const check = await fetch(`http://127.0.0.1:${playbackPort}/`, { signal: AbortSignal.timeout(500) });
        if (check.ok) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) {
      if (playbacks.get(project.id)?.child === child) playbacks.delete(project.id);
      killProcessTree(child);
      const details = [playbackError, ...playbackOutput.slice(-8)].filter(Boolean).join("\n");
      throw new HttpError(
        502,
        `O player de animação não iniciou.${details ? ` Saída do CLI: ${details}` : " Verifique as dependências."}`,
      );
    }
    response.status(201).json({ url: `http://127.0.0.1:${playbackPort}` });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/preview/stop", projectMiddleware, (request, response, next) => {
  const id = routeId(request);
  const playback = playbacks.get(id);
  if (!playback) {
    next(new HttpError(404, "Não há reprodução ativa para este projeto."));
    return;
  }
  killProcessTree(playback.child);
  playbacks.delete(id);
  response.status(204).end();
});

app.post("/api/projects/:id/export", projectMiddleware, async (request, response, next) => {
  try {
    const project = await getProject(routeId(request));
    if (!playbacks.has(project.id)) {
      throw new HttpError(409, "Inicie e revise a animação no player antes de exportar.");
    }
    if ([...tasks.values()].some(({ snapshot }) => snapshot.projectId === project.id && snapshot.status === "running")) {
      throw new HttpError(409, "Aguarde ou cancele a tarefa atual antes de iniciar a exportação.");
    }
    const requestedName = typeof request.body?.filename === "string" ? request.body.filename.trim() : "";
    if (!requestedName || requestedName.length > 100 || /[<>:"/\\|?*\u0000-\u001f]/.test(requestedName)) {
      throw new HttpError(400, "Informe um nome de arquivo válido, sem caminhos.");
    }
    if (request.body?.previewReviewed !== true) {
      throw new HttpError(400, "Confirme que revisou a animação no player antes de exportar.");
    }
    const destination = request.body?.destination;
    if (destination !== "exports" && destination !== "project") {
      throw new HttpError(400, "Escolha uma pasta de saída autorizada.");
    }
    const filename = requestedName.toLowerCase().endsWith(".mp4") ? requestedName : `${requestedName}.mp4`;
    const projectDir = safeProjectDirectory(project.id);
    const exportsDir = destination === "exports" ? path.join(projectDir, "exports") : projectDir;
    assertInside(projectDir, exportsDir);
    if (destination === "exports") await fs.mkdir(exportsDir, { recursive: true });
    const realOutputDir = await fs.realpath(exportsDir);
    assertInside(projectDir, realOutputDir);
    const outputPath = assertInside(realOutputDir, path.join(realOutputDir, filename));
    let overwrite = false;
    try {
      const existing = await fs.lstat(outputPath);
      if (existing.isSymbolicLink() || !existing.isFile()) {
        throw new HttpError(400, "O destino já existe e não é um arquivo regular autorizado.");
      }
      overwrite = true;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (overwrite && request.body?.overwrite !== true) {
      throw new HttpError(409, "O arquivo já existe. Confirme a substituição explicitamente.");
    }
    const snapshot = await startTask(project, "render", "hyperframes", ["render", "-o", outputPath]);
    response.status(202).json({ task: snapshot, outputPath });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/transcribe", projectMiddleware, async (request, response, next) => {
  try {
    const project = await getProject(routeId(request));
    if ([...tasks.values()].some(({ snapshot }) => snapshot.projectId === project.id && snapshot.status === "running")) {
      throw new HttpError(409, "Aguarde ou cancele a tarefa atual antes de transcrever.");
    }
    const requestedPath = typeof request.body?.path === "string" ? request.body.path.trim() : "";
    if (!requestedPath) throw new HttpError(400, "Escolha um arquivo de áudio ou vídeo do projeto.");
    const projectDir = safeProjectDirectory(project.id);
    const files = await listProjectFiles(projectDir);
    const source = files.find((file) => file.path === requestedPath);
    if (!source) throw new HttpError(404, "O arquivo informado não existe neste projeto.");
    const summary = await transcribeProjectMedia(project, source);
    response.status(201).json(summary);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:id/transcripts/:name", projectMiddleware, async (request, response, next) => {
  try {
    const projectDir = safeProjectDirectory(routeId(request));
    const name = request.params.name;
    if (typeof name !== "string" || !/^[\w.-]+\.json$/.test(name)) throw new HttpError(400, "Nome de transcrição inválido.");
    const transcriptPath = assertInside(projectDir, path.join(projectDir, "transcripts", name));
    const raw = await fs.readFile(transcriptPath, "utf8");
    response.type("application/json").send(raw);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/open-exports", projectMiddleware, async (request, response, next) => {
  try {
    const exportsDir = path.join(safeProjectDirectory(routeId(request)), "exports");
    await fs.mkdir(exportsDir, { recursive: true });
    if (process.platform !== "win32") throw new HttpError(501, "Abrir a pasta pelo aplicativo só está disponível no Windows.");
    const explorer = path.join(process.env.SystemRoot ?? "C:\\Windows", "explorer.exe");
    const child = spawn(explorer, [exportsDir], { shell: false, detached: true, stdio: "ignore" });
    child.unref();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/warmup", projectMiddleware, async (request, response, next) => {
  try {
    const project = await getProject(routeId(request));
    await installProjectGuidance(
      safeProjectDirectory(project.id),
      path.join(applicationRoot, "docs", "AI_VIDEO_PROJECT_WORKFLOW.md"),
      {
        aspectRatio: project.aspectRatio,
        resolution: project.resolution,
        frameRate: project.frameRate,
        description: project.description,
      },
    );
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_request, _response, next) => next(new HttpError(404, "Operação da API não encontrada.")));

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE" ? "O arquivo excede o limite de 500 MB." : error.message,
    });
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
  response.status(status).json({ error: message });
};
app.use(errorHandler);

const frontendDirectory = path.join(applicationRoot, "dist");
app.use(express.static(frontendDirectory));
app.get("/{*splat}", (_request, response, next) => {
  response.sendFile(path.join(frontendDirectory, "index.html"), (error) => {
    if (error) next(error);
  });
});

await fs.mkdir(projectsRoot, { recursive: true });
await fs.mkdir(referencesRoot, { recursive: true });
await fs.mkdir(uploadsRoot, { recursive: true });
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Daime Motion disponível em http://127.0.0.1:${port}`);
  console.log(`Biblioteca local: ${dataRoot}`);
});
server.once("error", (error) => {
  console.error(`Não foi possível iniciar o backend local: ${error.message}`);
  process.exitCode = 1;
});

async function shutdown(): Promise<void> {
  server.close();
  for (const task of tasks.values()) {
    if (task.snapshot.status === "running") killProcessTree(task.child);
  }
  for (const playback of playbacks.values()) killProcessTree(playback.child);
  await new Promise((resolve) => setTimeout(resolve, 300));
  process.exit(0);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
