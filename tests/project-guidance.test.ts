import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { installProjectGuidance, replaceManagedSection } from "../server/project-guidance";

const start = "<!-- BEGIN MANAGED -->";
const end = "<!-- END MANAGED -->";

describe("project agent guidance", () => {
  it("appends a managed section without changing existing instructions", () => {
    const result = replaceManagedSection("# Existing rules\n", start, end, "New rules");

    expect(result).toBe("# Existing rules\n\n<!-- BEGIN MANAGED -->\nNew rules\n<!-- END MANAGED -->\n");
  });

  it("updates its own section idempotently while preserving user content", () => {
    const first = replaceManagedSection("# User rules\n", start, end, "Old rules");
    const updated = replaceManagedSection(first, start, end, "New rules");

    expect(updated).toContain("# User rules");
    expect(updated).toContain("New rules");
    expect(updated).not.toContain("Old rules");
    expect(replaceManagedSection(updated, start, end, "New rules")).toBe(updated);
  });

  it("rejects incomplete markers instead of risking instruction-file corruption", () => {
    expect(() => replaceManagedSection("# User rules\n" + start, start, end, "New rules")).toThrow(
      "incomplete managed guidance markers",
    );
  });

  it("installs shared guidance without overwriting project documentation", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "daime-guidance-"));
    const projectDirectory = path.join(root, "project");
    const sourceDocumentation = path.join(root, "workflow.md");
    await fs.mkdir(projectDirectory);
    await fs.writeFile(sourceDocumentation, "# Workflow guide\n", "utf8");
    await fs.writeFile(path.join(projectDirectory, "AGENTS.md"), "# Existing agent rules\n", "utf8");
    await fs.writeFile(path.join(projectDirectory, "CLAUDE.md"), "# Existing Claude rules\n", "utf8");

    try {
      await installProjectGuidance(projectDirectory, sourceDocumentation, {
        aspectRatio: "16:9",
        resolution: "landscape",
        frameRate: 30,
        description: "A short test project.",
      });
      await fs.writeFile(sourceDocumentation, "# Updated source guide\n", "utf8");
      await installProjectGuidance(projectDirectory, sourceDocumentation, {
        aspectRatio: "16:9",
        resolution: "landscape",
        frameRate: 30,
        description: "A short test project.",
      });

      expect(await fs.readFile(path.join(projectDirectory, "DAIME-MOTION-WORKFLOW.md"), "utf8")).toBe(
        "# Workflow guide\n",
      );
      expect(await fs.readFile(path.join(projectDirectory, "AGENTS.md"), "utf8")).toContain(
        "[DAIME-MOTION-WORKFLOW.md](./DAIME-MOTION-WORKFLOW.md)",
      );
      expect(await fs.readFile(path.join(projectDirectory, "CLAUDE.md"), "utf8")).toContain("@AGENTS.md");
      expect(await fs.readFile(path.join(projectDirectory, "AGENTS.md"), "utf8")).toContain(
        "# Existing agent rules",
      );
      expect(await fs.readFile(path.join(projectDirectory, "CLAUDE.md"), "utf8")).toContain(
        "# Existing Claude rules",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
