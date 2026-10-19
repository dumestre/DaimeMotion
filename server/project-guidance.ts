import { promises as fs } from "node:fs";
import path from "node:path";

const agentsStart = "<!-- BEGIN DAIME MOTION PROJECT GUIDANCE -->";
const agentsEnd = "<!-- END DAIME MOTION PROJECT GUIDANCE -->";
const claudeStart = "<!-- BEGIN DAIME MOTION CLAUDE GUIDANCE -->";
const claudeEnd = "<!-- END DAIME MOTION CLAUDE GUIDANCE -->";

export function replaceManagedSection(
  contents: string,
  startMarker: string,
  endMarker: string,
  section: string,
): string {
  const start = contents.indexOf(startMarker);
  const end = contents.indexOf(endMarker);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error("Project instructions contain incomplete managed guidance markers.");
  }

  const managed = `${startMarker}\n${section.trim()}\n${endMarker}`;
  if (start === -1) return `${contents.trimEnd()}\n\n${managed}\n`;

  const endExclusive = end + endMarker.length;
  return `${contents.slice(0, start)}${managed}${contents.slice(endExclusive)}`;
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function installProjectGuidance(
  projectDirectory: string,
  documentationSource: string,
  project: { aspectRatio: string; resolution: string; frameRate: number; description: string },
): Promise<void> {
  const documentation = await fs.readFile(documentationSource, "utf8");
  const documentationPath = path.join(projectDirectory, "DAIME-MOTION-WORKFLOW.md");

  try {
    await fs.writeFile(documentationPath, documentation, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const stat = await fs.stat(documentationPath);
    if (!stat.isFile()) throw new Error("The project workflow documentation path is not a file.");
  }

  const agentsPath = path.join(projectDirectory, "AGENTS.md");
  const existingAgents = await readOptionalFile(agentsPath);
  const agentsSection = [
    "## Daime Motion project workflow",
    "",
    "Read [DAIME-MOTION-WORKFLOW.md](./DAIME-MOTION-WORKFLOW.md) before creating or editing compositions.",
    "Edit incrementally within the requested scene, preserve unrelated work, and validate the real preview before handoff.",
    "Do not render or export a final MP4 unless the user explicitly requests it.",
    "",
    `Project format: ${project.aspectRatio}, ${project.resolution}, ${project.frameRate} fps.`,
    `Project description: ${project.description || "Not provided."}`,
  ].join("\n");
  await fs.writeFile(
    agentsPath,
    replaceManagedSection(existingAgents, agentsStart, agentsEnd, agentsSection),
    "utf8",
  );

  const claudePath = path.join(projectDirectory, "CLAUDE.md");
  const existingClaude = await readOptionalFile(claudePath);
  const claudeSection = [
    "## Daime Motion project guidance",
    "",
    "Use the shared project instructions in `AGENTS.md` and follow the detailed scene-editing and validation workflow in `DAIME-MOTION-WORKFLOW.md`.",
    "",
    "@AGENTS.md",
  ].join("\n");
  await fs.writeFile(
    claudePath,
    replaceManagedSection(existingClaude, claudeStart, claudeEnd, claudeSection),
    "utf8",
  );
}
