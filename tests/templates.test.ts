import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isTemplateId, seedCompositionHtml, seedProjectComposition, templateIds } from "../server/templates";

describe("project template seeds", () => {
  it("accepts only the known template identifiers", () => {
    for (const id of templateIds) expect(isTemplateId(id)).toBe(true);
    expect(isTemplateId("unknown")).toBe(false);
    expect(isTemplateId(42)).toBe(false);
  });

  it("builds a standalone GSAP composition with a registered paused timeline", () => {
    const html = seedCompositionHtml({
      templateId: "music-video",
      name: "Clipe de teste",
      resolution: "landscape",
      frameRate: 25,
    });

    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-fps="25"');
    expect(html).toContain('data-duration="10"');
    expect(html).toContain("gsap.timeline({ paused: true })");
    expect(html).toContain('window.__timelines["main"] = tl');
    expect(html).toContain("gsap@3.14.2");
    expect(html).toContain("Daime Motion — Clipe de teste");
  });

  it("keeps every template inside a root without a wrapping template element", () => {
    for (const id of templateIds) {
      const html = seedCompositionHtml({
        templateId: id,
        name: "Formato",
        resolution: id === "music-video" ? "landscape" : id === "vertical-social" ? "portrait" : "square",
        frameRate: 30,
      });
      expect(html).not.toContain("<template>");
      expect(html).not.toContain("Math.random");
      expect(html).not.toContain("Date.now");
      const clipIds = [...html.matchAll(/id="([^"]+)" class="clip"/g)].map((match) => match[1]);
      expect(new Set(clipIds).size).toBe(clipIds.length);
    }
  });

  it("switches the canvas to portrait and square formats per resolution", () => {
    const portrait = seedCompositionHtml({
      templateId: "vertical-social",
      name: "Story",
      resolution: "portrait-720p",
      frameRate: 30,
    });
    expect(portrait).toContain('data-width="720"');
    expect(portrait).toContain('data-height="1280"');

    const square = seedCompositionHtml({
      templateId: "square-promo",
      name: "Promo",
      resolution: "square-4k",
      frameRate: 30,
    });
    expect(square).toContain('data-width="2160"');
    expect(square).toContain('data-height="2160"');
  });

  it("scales type and geometry with 4K landscape resolutions", () => {
    const fullHd = seedCompositionHtml({
      templateId: "music-video",
      name: "HD",
      resolution: "landscape",
      frameRate: 30,
    });
    const ultraHd = seedCompositionHtml({
      templateId: "music-video",
      name: "4K",
      resolution: "landscape-4k",
      frameRate: 30,
    });

    const fontSize = (html: string) => Number(/#word-a \{[^}]*font-size: (\d+)px/s.exec(html)?.[1]);
    expect(fontSize(ultraHd)).toBe(fontSize(fullHd) * 2);
    expect(ultraHd).toContain('data-width="3840"');
  });

  it("escapes project names before inserting them into the document", () => {
    const html = seedCompositionHtml({
      templateId: "music-video",
      name: '<script>alert("x")</script>',
      resolution: "landscape",
      frameRate: 30,
    });

    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("writes the seeded composition over the scaffold index.html", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "daime-template-"));
    try {
      await seedProjectComposition(root, {
        templateId: "vertical-social",
        name: "Reels",
        resolution: "portrait",
        frameRate: 30,
      });
      const written = await fs.readFile(path.join(root, "index.html"), "utf8");
      expect(written).toContain('data-width="1080"');
      expect(written).toContain('data-height="1920"');
      expect(written).toContain('data-fps="30"');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("builds a seek-safe three.js composition for every 3D template", () => {
    const threeD = templateIds.filter((id) => id.endsWith("-3d"));
    expect(threeD).toHaveLength(3);
    for (const id of threeD) {
      const html = seedCompositionHtml({
        templateId: id,
        name: "Volume",
        resolution: id === "music-video-3d" ? "landscape" : id === "vertical-social-3d" ? "portrait" : "square",
        frameRate: 30,
      });
      expect(html).toContain('id="three-stage"');
      expect(html).toContain('type="importmap"');
      expect(html).toContain("three@0.186.0");
      expect(html).toContain("hf-seek");
      expect(html).toContain("window.__hfThreeTime");
      expect(html).toContain('data-duration="10"');
      expect(html).toContain("gsap.timeline({ paused: true })");
      expect(html).toContain('window.__timelines["main"] = tl');
      expect(html).not.toContain("requestAnimationFrame");
      expect(html).not.toContain("setAnimationLoop");
      expect(html).not.toContain("performance.now");
      expect(html).not.toContain("Date.now");
      expect(html).not.toContain("Math.random");
    }
  });

  it("keeps the 3D stage pinned to the requested canvas size", () => {
    const ultraHd = seedCompositionHtml({
      templateId: "music-video-3d",
      name: "4K 3D",
      resolution: "landscape-4k",
      frameRate: 30,
    });
    expect(ultraHd).toContain('data-width="3840"');
    expect(ultraHd).toContain('data-height="2160"');
    expect(ultraHd).toContain("const width = 3840");
    expect(ultraHd).toContain("const height = 2160");
  });
});
