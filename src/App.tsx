import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Copy,
  ExternalLink,
  FileAudio2,
  FileImage,
  FileVideo2,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  MonitorPlay,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

function DaimeLogo({ size = 28 }: { size?: number }) {
  const uid = "daime-logo";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 316"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-top`} x1="34" y1="17.5" x2="284" y2="172.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F2EFE8" />
          <stop offset="1" stopColor="#B6B0A5" />
        </linearGradient>
        <linearGradient id={`${uid}-mid`} x1="14" y1="137.5" x2="309" y2="262.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D6D0C5" />
          <stop offset="1" stopColor="#8C877D" />
        </linearGradient>
        <linearGradient id={`${uid}-bottom`} x1="9" y1="232.5" x2="314" y2="352.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A39D92" />
          <stop offset="1" stopColor="#494640" />
        </linearGradient>
      </defs>

      <g stroke="#191816" strokeOpacity=".18" strokeWidth="2" strokeLinejoin="round">
        <path d="M148 4.5C156 -0.166667 164 -0.166667 172 4.5L312 85.5C321.333 90.8333 321.333 96.5 312 102.5L172 183.5C164 188.167 156 188.167 148 183.5L8 102.5C-1.33333 96.5 -1.33333 90.8333 8 85.5L148 4.5Z" fill={`url(#${uid}-top)`} />
        <path d="M8 152.5C1.33333 148.5 1.33333 144.5 8 140.5L39 122.5L148 185.5C156 190.167 164 190.167 172 185.5L281 122.5L312 140.5C318.667 144.5 318.667 148.5 312 152.5L172 233.5C164 238.167 156 238.167 148 233.5L8 152.5Z" fill={`url(#${uid}-mid)`} />
        <path d="M8 230.5C1.33333 226.5 1.33333 222.5 8 218.5L39 200.5L148 263.5C156 268.167 164 268.167 172 263.5L281 200.5L312 218.5C318.667 222.5 318.667 226.5 312 230.5L172 311.5C164 316.167 156 316.167 148 311.5L8 230.5Z" fill={`url(#${uid}-bottom)`} />
      </g>
    </svg>
  );
}
import type {
  ApiError,
  AspectRatio,
  ApprovedReference,
  Project,
  ProjectFile,
  ProjectTemplate,
  TaskSnapshot,
  ToolStatus,
} from "./shared/types";

type Section = "projects" | "studio" | "media" | "references" | "templates" | "settings";
type ProjectDraft = {
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  resolution: string;
  frameRate: number;
};

const resolutionOptions: { ratio: AspectRatio; value: string; label: string }[] = [
  { ratio: "16:9", value: "landscape", label: "1920 × 1080 · Full HD" },
  { ratio: "16:9", value: "landscape-720p", label: "1280 × 720 · HD" },
  { ratio: "16:9", value: "landscape-4k", label: "3840 × 2160 · 4K" },
  { ratio: "16:9", value: "landscape-480p", label: "854 × 480" },
  { ratio: "9:16", value: "portrait", label: "1080 × 1920 · Full HD" },
  { ratio: "9:16", value: "portrait-720p", label: "720 × 1280 · HD" },
  { ratio: "9:16", value: "portrait-4k", label: "2160 × 3840 · 4K" },
  { ratio: "9:16", value: "portrait-480p", label: "480 × 854" },
  { ratio: "1:1", value: "square", label: "1080 × 1080" },
  { ratio: "1:1", value: "square-720p", label: "720 × 720" },
  { ratio: "1:1", value: "square-4k", label: "2160 × 2160 · 4K" },
  { ratio: "1:1", value: "square-480p", label: "480 × 480" },
];

const emptyDraft: ProjectDraft = {
  name: "",
  description: "",
  aspectRatio: "16:9",
  resolution: "landscape",
  frameRate: 30,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String((body as ApiError).error)
      : `A solicitação falhou (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function resolutionLabel(value: string): string {
  return resolutionOptions.find((option) => option.value === value)?.label.split(" · ")[0] ?? value;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function fileIcon(kind: ProjectFile["kind"]): LucideIcon {
  if (kind === "audio") return FileAudio2;
  if (kind === "image") return FileImage;
  if (kind === "video") return FileVideo2;
  return kind === "font" ? FileImage : Clapperboard;
}

export default function App() {
  const [section, setSection] = useState<Section>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [dataDirectory, setDataDirectory] = useState("");
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem("daime-motion.selected-project") ?? "");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [references, setReferences] = useState<ApprovedReference[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePurpose, setReferencePurpose] = useState<ApprovedReference["purpose"]>("visual");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [task, setTask] = useState<TaskSnapshot | null>(null);
  const [playerUrl, setPlayerUrl] = useState("");
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [previewReviewed, setPreviewReviewed] = useState(false);
  const [exportDestination, setExportDestination] = useState<"exports" | "project">("exports");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [selectedTemplateId, setSelectedTemplateId] = useState("music-video");
  const [allowGlobalSkills, setAllowGlobalSkills] = useState(false);
  const [modal, setModal] = useState<"create" | "export" | null>(null);
  const [exportName, setExportName] = useState("video-final");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const warmupRef = useRef<Set<string>>(new Set());

  const project = useMemo(() => projects.find((item) => item.id === selectedId) ?? null, [projects, selectedId]);

  const refreshProjects = useCallback(async () => {
    const result = await api<Project[]>("/api/projects");
    setProjects(result);
    if (selectedId && !result.some((item) => item.id === selectedId)) {
      setSelectedId("");
      localStorage.removeItem("daime-motion.selected-project");
      setSection("projects");
    }
  }, [selectedId]);

  const refreshFiles = useCallback(async (id: string) => {
    const result = await api<ProjectFile[]>(`/api/projects/${id}/files`);
    setFiles(result);
  }, []);

  const refreshReferences = useCallback(async () => {
    setReferences(await api<ApprovedReference[]>("/api/references"));
  }, []);

  useEffect(() => {
    Promise.all([
      api<Project[]>("/api/projects"),
      api<ProjectTemplate[]>("/api/templates"),
      api<{ dataDirectory: string; tools: ToolStatus[] }>("/api/health"),
    ])
      .then(([savedProjects, savedTemplates, health]) => {
        setProjects(savedProjects);
        setTemplates(savedTemplates);
        setDataDirectory(health.dataDirectory);
        setTools(health.tools);
        if (selectedId && savedProjects.some((item) => item.id === selectedId)) {
          setSection("studio");
          void refreshFiles(selectedId);
        } else if (selectedId) {
          setSelectedId("");
          localStorage.removeItem("daime-motion.selected-project");
        }
      })
      .catch((reason: Error) => setError(reason.message));
    void refreshReferences().catch((reason: Error) => setError(reason.message));
  }, [refreshFiles, refreshReferences, selectedId]);

  useEffect(() => {
    if (!task || task.status !== "running") return;
    const timer = window.setInterval(() => {
      api<TaskSnapshot>(`/api/tasks/${task.id}`)
        .then((latest) => {
          setTask(latest);
          if (latest.status !== "running") {
            window.clearInterval(timer);
            if (latest.projectId === selectedId) {
              void refreshFiles(latest.projectId).catch((reason: Error) => setError(reason.message));
              void refreshProjects().catch((reason: Error) => setError(reason.message));
            }
          }
        })
        .catch((reason: Error) => {
          window.clearInterval(timer);
          setError(reason.message);
        });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [task, selectedId, refreshFiles, refreshProjects]);

  function openProject(item: Project) {
    setSelectedId(item.id);
    localStorage.setItem("daime-motion.selected-project", item.id);
    setSection("studio");
    setTask(null);
    setPlayerUrl("");
    setPreviewReviewed(false);
    setError("");
    void refreshFiles(item.id).catch((reason: Error) => setError(reason.message));
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setAllowGlobalSkills(false);
    setDraft((current) => ({
      ...current,
      aspectRatio: template.aspectRatio,
      resolution: template.resolution,
      frameRate: template.frameRate,
    }));
    setModal("create");
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, allowGlobalSkills }),
      });
      setProjects((current) => [created, ...current]);
      setModal(null);
      setDraft(emptyDraft);
      setPlayerUrl("");
      openProject(created);
      setNotice("Projeto criado com o HyperFrames.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicateProject(item: Project) {
    setError("");
    try {
      const duplicate = await api<Project>(`/api/projects/${item.id}/duplicate`, { method: "POST" });
      setProjects((current) => [duplicate, ...current]);
      setNotice(`“${item.name}” foi duplicado.`);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function deleteProject(item: Project) {
    if (!window.confirm(`Excluir “${item.name}” e todos os arquivos deste projeto? Esta ação não pode ser desfeita.`)) return;
    setError("");
    try {
      await api<void>(`/api/projects/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      setProjects((current) => current.filter((candidate) => candidate.id !== item.id));
      if (selectedId === item.id) {
        setSelectedId("");
        localStorage.removeItem("daime-motion.selected-project");
        setSection("projects");
        setFiles([]);
        setTask(null);
        setPlayerUrl("");
        setPreviewReviewed(false);
      }
      setNotice("Projeto excluído.");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function runAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !prompt.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setPlayerUrl("");
    setPreviewReviewed(false);
    try {
      const started = await api<TaskSnapshot>(`/api/projects/${project.id}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setTask(started);
      setPrompt("");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask() {
    if (!task) return;
    try {
      setTask(await api<TaskSnapshot>(`/api/tasks/${task.id}/cancel`, { method: "POST" }));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function startPlayback() {
    if (!project || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>(`/api/projects/${project.id}/preview`, { method: "POST" });
      setPlayerUrl(result.url);
      setPlaybackRevision((revision) => revision + 1);
      setPreviewReviewed(false);
      setNotice("Animação iniciada no player, sem renderizar um arquivo de vídeo.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stopPlayback() {
    if (!project) return;
    try {
      await api<void>(`/api/projects/${project.id}/preview/stop`, { method: "POST" });
      setPlayerUrl("");
      setPreviewReviewed(false);
      setNotice("Reprodução da animação encerrada.");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function exportVideo(overwrite = false) {
    if (!project || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ task: TaskSnapshot; outputPath: string }>(`/api/projects/${project.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: exportName.trim(),
          overwrite,
          destination: exportDestination,
          previewReviewed,
        }),
      });
      setTask(result.task);
      setModal(null);
      setNotice(`Renderização iniciada: ${result.outputPath}`);
    } catch (reason) {
      const message = (reason as Error).message;
      if (!overwrite && message.includes("já existe")) {
        const shouldReplace = window.confirm(`${message}\n\nDeseja substituir o arquivo existente?`);
        if (shouldReplace) {
          setBusy(false);
          await exportVideo(true);
          return;
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!project) return;
    const formData = new FormData();
    formData.append("file", file);
    setError("");
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}/assets`, { method: "POST", body: formData });
      await refreshFiles(project.id);
      await refreshProjects();
      setNotice(`${file.name} importado para o projeto.`);
      setPlayerUrl("");
      setPreviewReviewed(false);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referenceFile || busy) return;
    const formData = new FormData();
    formData.append("file", referenceFile);
    formData.append("purpose", referencePurpose);
    formData.append("notes", referenceNotes);
    setError("");
    setBusy(true);
    try {
      await api<ApprovedReference>("/api/references", { method: "POST", body: formData });
      await refreshReferences();
      setReferenceFile(null);
      setReferenceNotes("");
      event.currentTarget.reset();
      setReferencePurpose("visual");
      setNotice(`${referenceFile.name} foi adicionada às referências aprovadas.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeReference(reference: ApprovedReference) {
    if (!window.confirm(`Remover “${reference.name}” da biblioteca de referências aprovadas?`)) return;
    setError("");
    setBusy(true);
    try {
      await api<void>(`/api/references/${reference.id}`, { method: "DELETE" });
      setReferences((current) => current.filter((item) => item.id !== reference.id));
      setNotice(`“${reference.name}” foi removida da biblioteca de referências.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openExports() {
    if (!project) return;
    try {
      await api<void>(`/api/projects/${project.id}/open-exports`, { method: "POST" });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  function goTo(sectionName: Section) {
    setSection(sectionName);
    setError("");
    if (sectionName === "media" && selectedId) {
      void refreshFiles(selectedId).catch((reason: Error) => setError(reason.message));
    }
    if (sectionName === "references") {
      void refreshReferences().catch((reason: Error) => setError(reason.message));
    }
    if (sectionName === "studio" && selectedId && !warmupRef.current.has(selectedId)) {
      warmupRef.current.add(selectedId);
      api<void>(`/api/projects/${selectedId}/warmup`, { method: "POST" }).catch(() => {});
    }
  }

  const activeTask = task?.status === "running";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => goTo("projects")} aria-label="Daime Motion — projetos">
          <span className="brand-icon"><DaimeLogo size={28} /></span>
          <span>Daime<span className="brand-light">Motion</span></span>
        </button>
        <div className="sidebar-label">ESTÚDIO</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <NavButton icon={FolderOpen} label="Projetos" active={section === "projects"} onClick={() => goTo("projects")} />
          {project && <NavButton icon={MonitorPlay} label="Estúdio" active={section === "studio"} onClick={() => goTo("studio")} />}
          <NavButton icon={AudioLines} label="Biblioteca de mídia" active={section === "media"} onClick={() => goTo("media")} />
          <NavButton icon={Bookmark} label="Referências aprovadas" active={section === "references"} onClick={() => goTo("references")} />
          <NavButton icon={Sparkles} label="Modelos" active={section === "templates"} onClick={() => goTo("templates")} />
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-status">
            <span className={`status-dot ${tools.length && tools.every((item) => item.available) ? "online" : ""}`} />
            <div><strong>Ambiente local</strong><small>{tools.filter((tool) => tool.available).length}/3 ferramentas prontas</small></div>
            <button className="icon-button" onClick={() => goTo("settings")} aria-label="Configurações"><Settings2 size={17} /></button>
          </div>
          <button className={`nav-button ${section === "settings" ? "active" : ""}`} onClick={() => goTo("settings")}>
            <Settings2 size={17} /><span>Configurações</span>
          </button>
          <div className="sidebar-footnote">Produção local · seus arquivos ficam no dispositivo</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Daime Motion</span><span className="crumb-slash">/</span>
            <strong>{section === "studio" && project ? project.name : sectionLabel(section)}</strong>
          </div>
          <div className="topbar-right">
            {project && section === "studio" && <span className="save-indicator"><Check size={14} /> Salvo localmente</span>}
            <span className="local-badge"><span className="status-dot online" /> LOOPBACK</span>
          </div>
        </header>

        {error && <div className="alert error-alert"><Activity size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar"><X size={16} /></button></div>}
        {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar"><X size={16} /></button></div>}

        {section === "projects" && (
          <ProjectsPage
            projects={projects}
            onCreate={() => { setDraft(emptyDraft); setSelectedTemplateId("music-video"); setAllowGlobalSkills(false); setModal("create"); }}
            onOpen={openProject}
            onDuplicate={duplicateProject}
            onDelete={deleteProject}
          />
        )}
        {section === "studio" && project && (
          <StudioPage
            project={project}
            files={files}
            task={task}
            prompt={prompt}
            setPrompt={setPrompt}
            activeTask={Boolean(activeTask)}
            playerUrl={playerUrl}
            playbackRevision={playbackRevision}
            previewReviewed={previewReviewed}
            busy={busy}
            onRunAgent={runAgent}
            onCancelTask={cancelTask}
            onPlayback={startPlayback}
            onStopPlayback={stopPlayback}
            onImport={importFile}
            onExport={() => { setExportName("video-final"); setExportDestination("exports"); setPreviewReviewed(false); setModal("export"); }}
            onOpenExports={openExports}
            onMedia={() => goTo("media")}
          />
        )}
        {section === "studio" && !project && <EmptySelection onProjects={() => goTo("projects")} />}
        {section === "media" && (
          <MediaPage project={project} files={files} busy={busy} onImport={importFile} onChooseProject={() => goTo("projects")} />
        )}
        {section === "references" && (
          <ReferencesPage
            references={references}
            file={referenceFile}
            purpose={referencePurpose}
            notes={referenceNotes}
            busy={busy}
            onFile={setReferenceFile}
            onPurpose={setReferencePurpose}
            onNotes={setReferenceNotes}
            onAdd={addReference}
            onRemove={removeReference}
          />
        )}
        {section === "templates" && <TemplatesPage templates={templates} onUse={applyTemplate} />}
        {section === "settings" && <SettingsPage tools={tools} dataDirectory={dataDirectory} />}
      </main>

      {modal === "create" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <form className="dialog project-dialog" onSubmit={createProject}>
            <div className="dialog-heading">
              <div><span className="eyebrow">NOVO PROJETO</span><h2>Comece uma composição</h2><p>O HyperFrames cria a estrutura oficial do projeto.</p></div>
              <button type="button" className="icon-button" onClick={() => setModal(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <label className="field-label">Nome do projeto<input autoFocus maxLength={80} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Clipe de verão" /></label>
            <label className="field-label">Descrição <span className="optional">opcional</span><textarea maxLength={500} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Conte um pouco sobre o vídeo..." /></label>
            <label className="field-label">Modelo inicial
              <span className="select-wrap"><select value={selectedTemplateId} onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                const template = templates.find((item) => item.id === event.target.value);
                if (template) setDraft((current) => ({ ...current, aspectRatio: template.aspectRatio, resolution: template.resolution, frameRate: template.frameRate }));
              }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}</select><ChevronDown size={15} /></span>
            </label>
            <div className="field-row">
              <label className="field-label">Proporção
                <span className="select-wrap"><select value={draft.aspectRatio} onChange={(event) => {
                  const ratio = event.target.value as AspectRatio;
                  const resolution = resolutionOptions.find((option) => option.ratio === ratio)?.value ?? "landscape";
                  setDraft({ ...draft, aspectRatio: ratio, resolution });
                }}>
                  {(["16:9", "9:16", "1:1"] as AspectRatio[]).map((ratio) => <option key={ratio}>{ratio}</option>)}
                </select><ChevronDown size={15} /></span>
              </label>
              <label className="field-label">Resolução
                <span className="select-wrap"><select value={draft.resolution} onChange={(event) => setDraft({ ...draft, resolution: event.target.value })}>
                  {resolutionOptions.filter((option) => option.ratio === draft.aspectRatio).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select><ChevronDown size={15} /></span>
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">Quadros por segundo
                <span className="select-wrap"><select value={draft.frameRate} onChange={(event) => setDraft({ ...draft, frameRate: Number(event.target.value) })}>
                  {[24, 25, 30, 50, 60].map((fps) => <option key={fps} value={fps}>{fps} fps</option>)}
                </select><ChevronDown size={15} /></span>
              </label>
              <div className="field-label">Armazenamento<span className="static-field"><FolderOpen size={15} /> Biblioteca local do Daime Motion</span></div>
            </div>
            <div className="global-skills-warning"><Sparkles size={16} /><span>O HyperFrames pode baixar skills oficiais do GitHub e instalá-las globalmente para sua conta do Windows, fora desta pasta de projeto.</span></div>
            <label className="review-check"><input type="checkbox" checked={allowGlobalSkills} onChange={(event) => setAllowGlobalSkills(event.target.checked)} /><span><strong>Autorizo o download e a instalação global das skills do HyperFrames.</strong><small>Necessário para executar o inicializador oficial; afeta os agentes configurados nesta conta.</small></span></label>
            <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" disabled={busy || !allowGlobalSkills}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Criar projeto</button></div>
          </form>
        </div>
      )}
      {modal === "export" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <form className="dialog export-dialog" onSubmit={(event) => { event.preventDefault(); void exportVideo(); }}>
            <div className="dialog-heading">
              <div><span className="eyebrow">EXPORTAÇÃO EXPLÍCITA</span><h2>Renderizar MP4</h2><p>A renderização final só começa após esta confirmação.</p></div>
              <button type="button" className="icon-button" onClick={() => setModal(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <label className="field-label">Nome do arquivo<input autoFocus required maxLength={100} value={exportName} onChange={(event) => setExportName(event.target.value)} /></label>
            <label className="field-label">Pasta de saída
              <span className="select-wrap"><select value={exportDestination} onChange={(event) => setExportDestination(event.target.value as "exports" | "project")}>
                <option value="exports">exports/ — pasta de exportação</option>
                <option value="project">Raiz do projeto</option>
              </select><ChevronDown size={15} /></span>
            </label>
            <div className="export-destination"><FolderOpen size={17} /><div><strong>Destino autorizado</strong><span>{project?.name} / {exportDestination === "exports" ? "exports / " : ""}{exportName || "video-final"}.mp4</span></div></div>
            <label className="review-check"><input type="checkbox" checked={previewReviewed} onChange={(event) => setPreviewReviewed(event.target.checked)} /><span><strong>Assisti e revisei a animação no player.</strong><small>A exportação em vídeo é uma etapa separada e não começa automaticamente.</small></span></label>
            <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Voltar ao estúdio</button><button className="button primary" disabled={busy || !playerUrl || !previewReviewed}>{busy ? <LoaderCircle className="spin" size={16} /> : <Video size={16} />} Iniciar renderização</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function sectionLabel(section: Section): string {
  return ({ projects: "Projetos", studio: "Estúdio", media: "Biblioteca de mídia", references: "Referências aprovadas", templates: "Modelos", settings: "Configurações" })[section];
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></button>;
}

function ProjectsPage({
  projects,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  projects: Project[];
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  return (
    <section className="page-content projects-page">
      <div className="page-heading">
        <div><span className="eyebrow">SEU ESPAÇO DE CRIAÇÃO</span><h1>Projetos</h1><p>Suas composições, organizadas e prontas para continuar.</p></div>
        <button className="button primary" onClick={onCreate}><Plus size={17} /> Novo projeto</button>
      </div>
      <div className="collection-heading"><div><h2>Todos os projetos</h2><span className="count-pill">{projects.length}</span></div><span className="muted">Salvos neste dispositivo</span></div>
      {projects.length ? <div className="project-grid">
        {projects.map((item, index) => <article className="project-card" key={item.id}>
          <button className="project-card-open" onClick={() => onOpen(item)} aria-label={`Abrir ${item.name}`}>
            <div className={`project-art art-${index % 4}`}>
              <div className="art-lines" /><span className="art-chip"><Clapperboard size={12} /> {item.aspectRatio}</span><span className="art-play"><Video size={18} /></span>
              <span className="art-caption">{item.name}</span>
            </div>
            <div className="project-card-info"><h3>{item.name}</h3><p>{item.description || "Sem descrição"}</p><div className="project-meta"><span><Clock3 size={13} /> {formatDate(item.updatedAt)}</span><span>{resolutionLabel(item.resolution)}</span></div></div>
          </button>
          <div className="project-card-actions"><button className="button small secondary" onClick={() => onOpen(item)}>Abrir projeto <ExternalLink size={13} /></button><div className="menu-actions"><button className="icon-button" onClick={() => onDuplicate(item)} title="Duplicar"><Copy size={15} /></button><button className="icon-button danger-icon" onClick={() => onDelete(item)} title="Excluir"><MoreHorizontal size={17} /></button></div></div>
        </article>)}
        <button className="new-project-card" onClick={onCreate}><span><Plus size={21} /></span><strong>Criar outra composição</strong><small>Comece com um projeto HyperFrames</small></button>
      </div> : <div className="empty-projects"><div className="empty-icon"><DaimeLogo size={32} /></div><h2>Seu próximo vídeo começa aqui</h2><p>Crie uma composição HyperFrames e transforme uma ideia em vídeo.</p><button className="button primary" onClick={onCreate}><Plus size={17} /> Criar primeiro projeto</button></div>}
      <div className="workspace-note"><span className="status-dot online" /><span>Projetos e mídia ficam no seu computador. Nada é enviado sem sua autorização.</span></div>
    </section>
  );
}

function StudioPage({
  project,
  files,
  task,
  prompt,
  setPrompt,
  activeTask,
  playerUrl,
  playbackRevision,
  previewReviewed,
  busy,
  onRunAgent,
  onCancelTask,
  onPlayback,
  onStopPlayback,
  onImport,
  onExport,
  onOpenExports,
  onMedia,
}: {
  project: Project;
  files: ProjectFile[];
  task: TaskSnapshot | null;
  prompt: string;
  setPrompt: (value: string) => void;
  activeTask: boolean;
  playerUrl: string;
  playbackRevision: number;
  previewReviewed: boolean;
  busy: boolean;
  onRunAgent: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelTask: () => void;
  onPlayback: () => void;
  onStopPlayback: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onOpenExports: () => void;
  onMedia: () => void;
}) {
  const mediaFiles = files.filter((file) => ["audio", "image", "video", "font"].includes(file.kind));
  return (
    <section className="studio-page">
      <div className="studio-titlebar">
        <div className="studio-project-title"><span className="project-title-icon"><Clapperboard size={17} /></span><div><h1>{project.name}</h1><span>{project.aspectRatio} <i /> {resolutionLabel(project.resolution)} <i /> {project.frameRate} fps</span></div></div>
        <div className="studio-actions"><button className="button secondary" onClick={onOpenExports}><FolderOpen size={15} /> Exportações</button><button className="button secondary" onClick={onPlayback} disabled={busy}><MonitorPlay size={15} /> {playerUrl ? "Reiniciar animação" : "Reproduzir animação"}</button><button className="button primary" onClick={onExport} disabled={!playerUrl || activeTask}><Video size={15} /> Exportar MP4</button></div>
      </div>
      <div className="studio-layout">
        <div className="studio-center">
          <div className="panel preview-panel">
            <div className="panel-header"><div><span className="live-dot" /><h2>Animação</h2><span className="panel-subtitle">Reprodução direta da composição</span></div><div className="panel-header-actions">{playerUrl && <a className="icon-button" href={playerUrl} target="_blank" rel="noreferrer" title="Abrir animação em nova aba"><ExternalLink size={14} /></a>}{playerUrl && <button className="icon-button" onClick={onStopPlayback} title="Encerrar reprodução"><X size={15} /></button>}<span className="aspect-pill">{project.aspectRatio}</span></div></div>
            <div className="preview-stage">
              {playerUrl ? <iframe key={`${playerUrl}-${playbackRevision}`} title={`Animação — ${project.name}`} src={playerUrl} /> : <div className="preview-placeholder">
                <div className="preview-placeholder-frame"><span className="placeholder-orb" /><span className="placeholder-words">ANIMAÇÃO<br />DA COMPOSIÇÃO</span><span className="placeholder-caption">Reprodução no navegador · sem render</span></div>
                <p>Reproduza a composição diretamente no navegador. Nenhum arquivo de vídeo é renderizado.</p><button className="button secondary" onClick={onPlayback} disabled={busy}><MonitorPlay size={15} /> {busy ? "Iniciando..." : "Reproduzir animação"}</button>
              </div>}
            </div>
            <div className="preview-footer"><span><span className={`status-dot ${playerUrl ? "online" : ""}`} /> {previewReviewed ? "Animação revisada" : "Player local"}</span><span>{playerUrl ? "Animação em tempo real · sem renderização de vídeo" : "A renderização MP4 é uma etapa separada"}</span></div>
          </div>
          <div className="panel assets-panel">
            <div className="panel-header"><div><h2>Assets do projeto</h2><span className="panel-subtitle">{mediaFiles.length} arquivos de mídia</span></div><div className="asset-actions"><button className="text-button" onClick={onMedia}>Ver biblioteca</button><label className="button small secondary upload-button"><Upload size={14} /> Importar<input type="file" accept="audio/*,image/*,video/*,.ttf,.otf,.woff,.woff2" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }} /></label></div></div>
            {mediaFiles.length ? <div className="asset-strip">{mediaFiles.slice(0, 6).map((file) => {
              const Icon = fileIcon(file.kind);
              return <div className="asset-item" key={file.path}><span className={`asset-icon ${file.kind}`}><Icon size={16} /></span><span className="asset-name">{file.name}</span><small>{formatSize(file.size)}{file.duration !== null ? ` · ${formatDuration(file.duration)}` : ""}</small></div>;
            })}</div> : <button className="asset-empty" onClick={onMedia}><ImagePlus size={18} /><span>Importe áudio, imagens ou vídeos para usar nesta composição</span><span className="asset-add">Adicionar mídia</span></button>}
          </div>
        </div>
        <aside className="studio-right">
          <div className="panel ai-panel">
            <div className="panel-header"><div className="ai-title"><span className="ai-icon"><Sparkles size={15} /></span><div><h2>Direção criativa</h2><span className="panel-subtitle">OpenCode · agente do projeto</span></div></div><span className="local-badge tiny">LOCAL</span></div>
            <form className="prompt-form" onSubmit={onRunAgent}>
              <label htmlFor="creative-prompt">Descreva o que você quer criar ou alterar</label>
              <textarea id="creative-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={activeTask} placeholder={"Ex.: Crie um videoclipe de trap com tipografia agressiva e partículas. Sincronize os cortes com a batida da música em assets/..." } />
              <div className="prompt-hint"><span>O agente trabalha somente na pasta deste projeto.</span><span>{prompt.length}/12.000</span></div>
              {activeTask
                ? <button type="button" className="button cancel-button" onClick={onCancelTask}><X size={15} /> Cancelar execução</button>
                : <button type="submit" className="button primary run-button" disabled={busy || !prompt.trim()}><Sparkles size={15} /> Enviar instrução</button>}
            </form>
            <div className="agent-suggestions"><span>IDEIAS PARA COMEÇAR</span><button onClick={() => setPrompt("Analise a composição e os assets existentes. Sugira uma estrutura visual coesa e, depois, implemente uma cena inicial usando apenas arquivos deste projeto.")}>Criar cena inicial <span>↗</span></button><button onClick={() => setPrompt("Revise os arquivos da composição e corrija qualquer problema visual que esteja impedindo a reprodução da animação no player. Explique os arquivos alterados.")}>Corrigir animação <span>↗</span></button></div>
          </div>
          <div className="panel activity-panel">
            <div className="panel-header"><div><h2>Atividade</h2><span className="panel-subtitle">Saída real do agente e das ferramentas</span></div>{task && <TaskStatus status={task.status} />}</div>
            {task ? <div className="task-detail">
              <div className="task-label"><span>{task.kind === "agent" ? "Instrução OpenCode" : "Renderização HyperFrames"}</span><small>{formatDate(task.startedAt)}</small></div>
              <div className="task-output" role="log" aria-live="polite">
                {task.output.length ? task.output.map((line, index) => <div className="output-line" key={`${index}-${line}`}>{line}</div>) : <div className="output-empty">{activeTask ? <><LoaderCircle className="spin" size={15} /> Aguardando saída do processo…</> : "O processo não emitiu saída."}</div>}
              </div>
              {task.error && <div className="task-error">{task.error}</div>}
              {task.finishedAt && <div className="task-finished">Processo encerrado em {formatDate(task.finishedAt)}. Confira a animação no player.</div>}
            </div> : <div className="activity-empty"><Activity size={19} /><p>As instruções enviadas e as renderizações aparecerão aqui.</p></div>}
          </div>
          <div className="panel project-files-panel">
            <div className="panel-header"><div><h2>Arquivos</h2><span className="panel-subtitle">Conteúdo do projeto HyperFrames</span></div><span className="count-pill">{files.length}</span></div>
            <div className="file-list">{files.slice(0, 8).map((file) => {
              const Icon = fileIcon(file.kind);
              return <div className="file-row" key={file.path}><Icon size={14} /><span title={file.path}>{file.path}</span><small>{formatSize(file.size)}</small></div>;
            })}{files.length > 8 && <button className="text-button" onClick={onMedia}>Ver todos os arquivos</button>}{files.length === 0 && <span className="no-files">Nenhum arquivo listado.</span>}</div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TaskStatus({ status }: { status: TaskSnapshot["status"] }) {
  const labels: Record<TaskSnapshot["status"], string> = { running: "Em execução", completed: "Processo concluído", failed: "Falhou", cancelled: "Cancelado" };
  return <span className={`task-status ${status}`}>{status === "running" && <LoaderCircle size={12} className="spin" />}{labels[status]}</span>;
}

function EmptySelection({ onProjects }: { onProjects: () => void }) {
  return <section className="page-content"><div className="empty-projects"><div className="empty-icon"><DaimeLogo size={32} /></div><h2>Escolha um projeto</h2><p>Abra um projeto para entrar no estúdio.</p><button className="button primary" onClick={onProjects}>Ver projetos</button></div></section>;
}

function MediaPage({ project, files, busy, onImport, onChooseProject }: { project: Project | null; files: ProjectFile[]; busy: boolean; onImport: (file: File) => void; onChooseProject: () => void }) {
  if (!project) return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">BIBLIOTECA LOCAL</span><h1>Biblioteca de mídia</h1><p>Os arquivos importados permanecem no projeto selecionado.</p></div></div><div className="empty-projects"><div className="empty-icon"><FolderOpen size={25} /></div><h2>Selecione um projeto primeiro</h2><p>A mídia é organizada separadamente para cada vídeo.</p><button className="button primary" onClick={onChooseProject}>Abrir projetos</button></div></section>;
  return <section className="page-content media-page">
    <div className="page-heading"><div><span className="eyebrow">ASSETS DO PROJETO</span><h1>Biblioteca de mídia</h1><p>Arquivos locais associados a <strong>{project.name}</strong>.</p></div><label className="button primary upload-button"><Upload size={16} /> Importar arquivo<input type="file" accept="audio/*,image/*,video/*,.ttf,.otf,.woff,.woff2" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }} /></label></div>
    <div className="privacy-note"><Activity size={16} /><span><strong>Privado por padrão.</strong> Arquivos ficam em {project.directory}; não são enviados para serviços externos.</span></div>
    <div className="media-table"><div className="media-table-head"><span>ARQUIVO</span><span>TIPO</span><span>TAMANHO</span><span>LOCALIZAÇÃO</span></div>
      {files.filter((file) => ["audio", "image", "video", "font"].includes(file.kind)).map((file) => {
        const Icon = fileIcon(file.kind);
        return <div className="media-row" key={file.path}><div className="media-name"><span className={`asset-icon ${file.kind}`}><Icon size={16} /></span><span><strong>{file.name}</strong><small>{file.kind === "audio" ? "Áudio" : file.kind === "image" ? "Imagem" : file.kind === "video" ? "Vídeo" : "Fonte"}{file.duration !== null ? ` · ${formatDuration(file.duration)}` : ""}</small></span></div><span className="type-pill">{file.kind}</span><span>{formatSize(file.size)}</span><code>{file.path}</code></div>;
      })}
      {!files.some((file) => ["audio", "image", "video", "font"].includes(file.kind)) && <div className="empty-table"><ImagePlus size={20} /><strong>Nenhuma mídia neste projeto</strong><span>Importe áudios, imagens e vídeos suportados.</span></div>}
    </div>
  </section>;
}

function referencePurposeLabel(purpose: ApprovedReference["purpose"]): string {
  return ({ visual: "Identidade visual", music: "Música e áudio", video: "Linguagem de vídeo" })[purpose];
}

function ReferencesPage({
  references,
  file,
  purpose,
  notes,
  busy,
  onFile,
  onPurpose,
  onNotes,
  onAdd,
  onRemove,
}: {
  references: ApprovedReference[];
  file: File | null;
  purpose: ApprovedReference["purpose"];
  notes: string;
  busy: boolean;
  onFile: (file: File | null) => void;
  onPurpose: (purpose: ApprovedReference["purpose"]) => void;
  onNotes: (notes: string) => void;
  onAdd: (event: React.FormEvent<HTMLFormElement>) => void;
  onRemove: (reference: ApprovedReference) => void;
}) {
  return <section className="page-content references-page">
    <div className="page-heading">
      <div><span className="eyebrow">BIBLIOTECA CURADA</span><h1>Referências aprovadas</h1><p>Um acervo local de inspiração, separado dos arquivos usados nos projetos.</p></div>
    </div>
    <div className="privacy-note"><Activity size={16} /><span><strong>Só entra o que você aprovar.</strong> Os arquivos ficam neste dispositivo e não são enviados nem usados para treinar modelos automaticamente.</span></div>
    <form className="reference-form" onSubmit={onAdd}>
      <div className="reference-form-heading"><div><h2>Adicionar uma referência</h2><p>Escolha a mídia e descreva o que ela deve inspirar.</p></div><Bookmark size={19} /></div>
      <label className="field-label">Arquivo de referência
        <input type="file" required accept="audio/*,image/*,video/*,.mp3,.wav,.aac,.m4a,.flac,.ogg,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mkv" disabled={busy} onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
        <small>Áudio, imagem ou vídeo · até 500 MB · não será adicionado a nenhum projeto.</small>
      </label>
      {file && <div className="reference-selected-file"><span>{file.name}</span><small>{formatSize(file.size)}</small></div>}
      <div className="reference-fields">
        <label className="field-label">Usar como referência para
          <span className="select-wrap"><select value={purpose} disabled={busy} onChange={(event) => onPurpose(event.target.value as ApprovedReference["purpose"])}>
            <option value="visual">Identidade visual</option>
            <option value="music">Música e áudio</option>
            <option value="video">Linguagem de vídeo</option>
          </select><ChevronDown size={15} /></span>
        </label>
        <label className="field-label">Observações <span className="optional">opcional</span>
          <textarea maxLength={500} rows={2} value={notes} disabled={busy} onChange={(event) => onNotes(event.target.value)} placeholder="Ex.: paleta quente, batida lenta, câmera na mão..." />
        </label>
      </div>
      <div className="reference-form-footer"><span>Adicionar significa aprovar esta referência para uso futuro.</span><button className="button primary" type="submit" disabled={busy || !file}><Upload size={15} /> Aprovar e adicionar</button></div>
    </form>
    <div className="collection-heading references-collection-heading"><div><h2>Seu acervo</h2><span className="count-pill">{references.length}</span></div><span className="muted">Salvo localmente entre projetos</span></div>
    {references.length ? <div className="reference-grid">{references.map((reference) => <article className="reference-card" key={reference.id}>
      <div className="reference-preview">
        {reference.kind === "image" ? <img src={reference.url} alt={`Referência: ${reference.name}`} loading="lazy" />
          : reference.kind === "video" ? <video src={reference.url} controls preload="metadata" />
            : <div className="reference-audio-preview"><AudioLines size={28} /><audio src={reference.url} controls preload="metadata" /></div>}
      </div>
      <div className="reference-card-info">
        <div className="reference-card-top"><span className="type-pill">{referencePurposeLabel(reference.purpose)}</span><button className="icon-button danger-icon" type="button" disabled={busy} onClick={() => onRemove(reference)} aria-label={`Remover ${reference.name}`} title="Remover referência"><Trash2 size={15} /></button></div>
        <h3 title={reference.name}>{reference.name}</h3>
        {reference.notes && <p>{reference.notes}</p>}
        <div className="reference-card-meta"><span>{reference.kind === "audio" ? "Áudio" : reference.kind === "image" ? "Imagem" : "Vídeo"}</span><span>{formatSize(reference.size)}</span><span>{formatDate(reference.createdAt)}</span></div>
      </div>
    </article>)}</div> : <div className="reference-empty"><Bookmark size={22} /><strong>Seu acervo começa com referências aprovadas por você.</strong><span>Adicione exemplos que representem o estilo ou a direção que deseja alcançar.</span></div>}
  </section>;
}

function TemplatesPage({ templates, onUse }: { templates: ProjectTemplate[]; onUse: (templateId: string) => void }) {
  return <section className="page-content templates-page"><div className="page-heading"><div><span className="eyebrow">PONTO DE PARTIDA</span><h1>Modelos</h1><p>Configurações reutilizáveis para iniciar um projeto HyperFrames.</p></div></div><div className="template-grid">{templates.map((template, index) => <article className="template-card" key={template.id}><div className={`template-art art-${index}`}><span>{template.aspectRatio}</span><div className="template-mark"><Sparkles size={24} /></div><small>{template.frameRate} FPS</small></div><div className="template-info"><span className="eyebrow">{template.resolution}</span><h2>{template.name}</h2><p>{template.description}</p><div className="template-style"><span>Direção visual</span>{template.style}</div><button className="button secondary" onClick={() => onUse(template.id)}>Usar modelo <Plus size={14} /></button></div></article>)}</div><p className="template-note">Os modelos aplicam proporção e resolução ao projeto. A composição de vídeo é criada e editada de verdade no HyperFrames.</p></section>;
}

function SettingsPage({ tools, dataDirectory }: { tools: ToolStatus[]; dataDirectory: string }) {
  return <section className="page-content settings-page"><div className="page-heading"><div><span className="eyebrow">AMBIENTE LOCAL</span><h1>Configurações</h1><p>Dependências, armazenamento e privacidade do estúdio.</p></div></div>
    <div className="settings-section"><div className="settings-heading"><h2>Ferramentas</h2><span>Verificadas no ambiente local</span></div><div className="tool-list">{tools.map((tool) => <div className="tool-row" key={tool.name}><span className={`tool-icon ${tool.available ? "available" : ""}`}>{tool.name === "OpenCode" ? <Sparkles size={17} /> : tool.name === "HyperFrames" ? <Clapperboard size={17} /> : <Video size={17} />}</span><div className="tool-info"><strong>{tool.name}</strong><small>{tool.available ? tool.version ?? "Disponível" : tool.installHint}</small></div><span className={`tool-state ${tool.available ? "ready" : "missing"}`}>{tool.available ? "Disponível" : "Não encontrado"}</span></div>)}</div></div>
    <div className="settings-section"><div className="settings-heading"><h2>Armazenamento</h2><span>Projetos e preferências persistidos no computador</span></div><div className="storage-card"><FolderOpen size={18} /><div><strong>Pasta de dados</strong><code>{dataDirectory || "Verificando…"}</code></div><span className="local-badge"><span className="status-dot online" /> SOMENTE NESTE DISPOSITIVO</span></div></div>
    <div className="settings-section safety-section"><div className="privacy-icon"><Activity size={19} /></div><div><h2>Privacidade e execução</h2><p>O backend escuta apenas em 127.0.0.1. As instruções são passadas ao OpenCode como argumento, não como comandos de shell. A exportação exige iniciar o player da animação e uma ação explícita.</p></div></div>
  </section>;
}
