import { promises as fs } from "node:fs";
import path from "node:path";

export const templateIds = [
  "music-video",
  "vertical-social",
  "square-promo",
  "music-video-3d",
  "vertical-social-3d",
  "square-promo-3d",
] as const;
export type TemplateId = (typeof templateIds)[number];

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (templateIds as readonly string[]).includes(value);
}

const resolutionSizes: Record<string, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  "landscape-720p": { width: 1280, height: 720 },
  "landscape-4k": { width: 3840, height: 2160 },
  "landscape-480p": { width: 854, height: 480 },
  portrait: { width: 1080, height: 1920 },
  "portrait-720p": { width: 720, height: 1280 },
  "portrait-4k": { width: 2160, height: 3840 },
  "portrait-480p": { width: 480, height: 854 },
  square: { width: 1080, height: 1080 },
  "square-720p": { width: 720, height: 720 },
  "square-4k": { width: 2160, height: 2160 },
  "square-480p": { width: 480, height: 480 },
};

type LayoutFamily = "landscape" | "portrait" | "square";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function familyFor(resolution: string): LayoutFamily {
  if (resolution.startsWith("portrait")) return "portrait";
  if (resolution.startsWith("square")) return "square";
  return "landscape";
}

function resolveCanvas(resolution: string, frameRate: number) {
  const size = resolutionSizes[resolution] ?? resolutionSizes.landscape;
  const family = familyFor(resolution);
  const baseWidth = family === "landscape" ? 1920 : 1080;
  const scale = size.width / baseWidth;
  const px = (value: number) => Math.round(value * scale);
  return { width: size.width, height: size.height, family, fps: frameRate, px };
}

function compositionShell(options: {
  width: number;
  height: number;
  fps: number;
  family: LayoutFamily;
  title: string;
  label: string;
  style: string;
  body: string;
  animation: string;
  head?: string;
  script?: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR" data-resolution="${options.family === "landscape" ? "landscape" : options.family === "portrait" ? "portrait" : "square"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${options.width}, height=${options.height}" />
    <title>${escapeHtml(options.title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>${options.head ?? ""}
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #100d17;
      }

      body {
        color: #fff7ec;
        font-family: Inter, Arial, sans-serif;
      }

      #root {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        isolation: isolate;
      }

      .clip {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .backdrop {
        z-index: 0;
        background:
          radial-gradient(ellipse 70% 90% at 22% 40%, rgba(255, 107, 53, 0.14), rgba(16, 13, 23, 0) 100%),
          radial-gradient(ellipse 60% 80% at 82% 70%, rgba(101, 230, 207, 0.12), rgba(16, 13, 23, 0) 100%),
          #100d17;
      }
${options.style}
    </style>
  </head>
  <body>
    <main
      id="root"
      data-composition-id="main"
      data-width="${options.width}"
      data-height="${options.height}"
      data-fps="${options.fps}"
      data-duration="10"
      aria-label="${escapeHtml(options.label)}"
    >
${options.body}
    </main>
    <script>
      const tl = gsap.timeline({ paused: true });
${options.animation}
      window.__timelines["main"] = tl;
    </script>${options.script ?? ""}
  </body>
</html>
`;
}

function landscapeScene(px: (value: number) => number): { style: string; body: string; animation: string } {
  const style = `
      #spectrum-clip {
        z-index: 2;
      }

      #spectrum {
        position: absolute;
        top: ${px(240)}px;
        left: ${px(132)}px;
        display: flex;
        width: ${px(446)}px;
        height: ${px(10)}px;
        transform-origin: left center;
        overflow: hidden;
        border-radius: 999px;
      }

      #spectrum span {
        display: block;
        height: 100%;
      }

      #spectrum span:nth-child(1) {
        width: 34%;
        background: #ff6b35;
      }

      #spectrum span:nth-child(2) {
        width: 31%;
        background: #ffd166;
      }

      #spectrum span:nth-child(3) {
        width: 35%;
        background: #65e6cf;
      }

      #orbit-clip {
        z-index: 2;
      }

      #orbit-field {
        position: absolute;
        top: ${px(250)}px;
        right: ${px(200)}px;
        width: ${px(430)}px;
        height: ${px(430)}px;
      }

      #orbit-ring-outer,
      #orbit-ring-inner,
      #orbit-spin {
        position: absolute;
        border-radius: 50%;
      }

      #orbit-ring-outer {
        inset: 0;
        border: ${Math.max(1, px(2))}px solid rgba(255, 247, 236, 0.5);
      }

      #orbit-ring-inner {
        inset: ${px(40)}px;
        border: ${Math.max(1, px(2))}px solid rgba(255, 107, 53, 0.85);
      }

      #orbit-spin {
        inset: ${px(-16)}px;
        border: ${Math.max(1, px(2))}px dashed rgba(101, 230, 207, 0.75);
      }

      #orbit-dot-hot {
        position: absolute;
        top: ${px(-14)}px;
        left: calc(50% - ${px(14)}px);
        width: ${px(28)}px;
        height: ${px(28)}px;
        border-radius: 50%;
        background: #ff6b35;
        box-shadow: 0 0 ${px(30)}px rgba(255, 107, 53, 0.9);
      }

      #title-clip {
        z-index: 3;
      }

      .headline {
        position: absolute;
        left: ${px(126)}px;
        margin: 0;
        color: #fff7ec;
        font-weight: 900;
        line-height: 0.9;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.55);
        white-space: nowrap;
      }

      #word-a {
        top: ${px(330)}px;
        font-size: ${px(190)}px;
        letter-spacing: -0.06em;
      }

      #word-b {
        top: ${px(548)}px;
        font-size: ${px(108)}px;
        letter-spacing: -0.04em;
        color: #65e6cf;
      }

      #brand-clip {
        z-index: 4;
      }

      #brand-lockup {
        position: absolute;
        top: ${px(400)}px;
        left: ${px(126)}px;
        color: #fff7ec;
        font-size: ${px(118)}px;
        font-weight: 900;
        letter-spacing: -0.07em;
        line-height: 1;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.56);
        white-space: nowrap;
      }

      #brand-lockup span {
        color: #ff6b35;
      }

      #brand-caption {
        position: absolute;
        top: ${px(560)}px;
        left: ${px(132)}px;
        color: #ffd166;
        font-size: ${px(26)}px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.7);
      }`;

  const body = `      <div id="backdrop" class="clip backdrop" data-start="0" data-duration="10" data-track-index="0" aria-hidden="true"></div>

      <div id="spectrum-clip" class="clip" data-start="0" data-duration="10" data-track-index="1" aria-hidden="true">
        <div id="spectrum"><span></span><span></span><span></span></div>
      </div>

      <div id="orbit-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-hidden="true">
        <div id="orbit-field">
          <div id="orbit-ring-outer"></div>
          <div id="orbit-ring-inner"></div>
          <div id="orbit-spin"><span id="orbit-dot-hot"></span></div>
        </div>
      </div>

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Título">
        <h1 id="word-a" class="headline">SEU CLIPE</h1>
        <h2 id="word-b" class="headline">EM MOVIMENTO</h2>
      </section>

      <section id="brand-clip" class="clip" data-start="0" data-duration="10" data-track-index="4" aria-label="Marca">
        <div id="brand-lockup">DAIME <span>MOTION</span></div>
        <div id="brand-caption">Ritmo · Luz · Cor</div>
      </section>`;

  const animation = `      tl.fromTo("#spectrum", { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.out" }, 0.3);
      tl.fromTo("#orbit-field", { scale: 0.72, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.6);
      tl.to("#orbit-spin", { rotation: 360, duration: 9.3, ease: "none" }, 0.7);
      tl.fromTo("#orbit-dot-hot", { scale: 0.7 }, { scale: 1.18, duration: 0.7, repeat: 5, yoyo: true, ease: "sine.inOut" }, 0.9);
      tl.fromTo(
        "#word-a",
        { x: -90, y: 30, scale: 0.85, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.4)" },
        0.5,
      );
      tl.to("#word-a", { y: -24, opacity: 0, duration: 0.28, ease: "power2.in" }, 2.6);
      tl.fromTo("#word-b", { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 1);
      tl.to("#word-b", { x: 36, opacity: 0, duration: 0.28, ease: "power2.in" }, 3.4);
      tl.fromTo(
        "#brand-lockup",
        { x: -70, scale: 0.9, opacity: 0 },
        { x: 0, scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.35)" },
        4.2,
      );
      tl.fromTo("#brand-caption", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, 4.55);
`;

  return { style, body, animation };
}

function portraitScene(px: (value: number) => number): { style: string; body: string; animation: string } {
  const style = `
      #spectrum-clip {
        z-index: 2;
      }

      #spectrum {
        position: absolute;
        top: ${px(150)}px;
        left: ${px(90)}px;
        display: flex;
        width: ${px(640)}px;
        height: ${px(12)}px;
        transform-origin: left center;
        overflow: hidden;
        border-radius: 999px;
      }

      #spectrum span {
        display: block;
        height: 100%;
      }

      #spectrum span:nth-child(1) {
        width: 38%;
        background: #ff6b35;
      }

      #spectrum span:nth-child(2) {
        width: 26%;
        background: #ffd166;
      }

      #spectrum span:nth-child(3) {
        width: 36%;
        background: #65e6cf;
      }

      #halo-clip {
        z-index: 2;
      }

      #halo-field {
        position: absolute;
        top: ${px(560)}px;
        left: ${px(90)}px;
        width: ${px(900)}px;
        height: ${px(900)}px;
      }

      #halo-ring,
      #halo-spin {
        position: absolute;
        border-radius: 50%;
      }

      #halo-ring {
        inset: 0;
        border: ${Math.max(1, px(2))}px solid rgba(255, 247, 236, 0.32);
      }

      #halo-spin {
        inset: ${px(70)}px;
        border: ${Math.max(1, px(2))}px dashed rgba(101, 230, 207, 0.5);
      }

      #title-clip {
        z-index: 3;
        text-align: center;
      }

      .headline {
        position: absolute;
        left: 0;
        right: 0;
        margin: 0;
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: -0.05em;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.55);
      }

      #word-a {
        top: ${px(700)}px;
        color: #fff7ec;
        font-size: ${px(170)}px;
      }

      #word-b {
        top: ${px(900)}px;
        color: #ff6b35;
        font-size: ${px(108)}px;
      }

      #dots-clip {
        z-index: 3;
      }

      #dots-row {
        position: absolute;
        top: ${px(1110)}px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: ${px(34)}px;
      }

      .stat-dot {
        display: block;
        width: ${px(26)}px;
        height: ${px(26)}px;
        border-radius: 50%;
      }

      .stat-dot:nth-child(1) {
        background: #ff6b35;
        box-shadow: 0 0 ${px(28)}px rgba(255, 107, 53, 0.8);
      }

      .stat-dot:nth-child(2) {
        background: #ffd166;
        box-shadow: 0 0 ${px(28)}px rgba(255, 209, 102, 0.8);
      }

      .stat-dot:nth-child(3) {
        background: #65e6cf;
        box-shadow: 0 0 ${px(28)}px rgba(101, 230, 207, 0.8);
      }

      #cta-clip {
        z-index: 4;
      }

      #cta-lockup {
        position: absolute;
        top: ${px(1560)}px;
        left: 0;
        right: 0;
        color: #fff7ec;
        font-size: ${px(30)}px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        text-align: center;
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.7);
      }`;

  const body = `      <div id="backdrop" class="clip backdrop" data-start="0" data-duration="10" data-track-index="0" aria-hidden="true"></div>

      <div id="spectrum-clip" class="clip" data-start="0" data-duration="10" data-track-index="1" aria-hidden="true">
        <div id="spectrum"><span></span><span></span><span></span></div>
      </div>

      <div id="halo-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-hidden="true">
        <div id="halo-field">
          <div id="halo-ring"></div>
          <div id="halo-spin"></div>
        </div>
      </div>

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Título">
        <h1 id="word-a" class="headline">SOCIAL</h1>
        <h2 id="word-b" class="headline">VERTICAL</h2>
      </section>

      <div id="dots-clip" class="clip" data-start="0" data-duration="10" data-track-index="4" aria-hidden="true">
        <div id="dots-row"><span class="stat-dot"></span><span class="stat-dot"></span><span class="stat-dot"></span></div>
      </div>

      <section id="cta-clip" class="clip" data-start="0" data-duration="10" data-track-index="5" aria-label="Chamada">
        <div id="cta-lockup">Role · Pause · Compartilhe</div>
      </section>`;

  const animation = `      tl.fromTo("#spectrum", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, 0.25);
      tl.fromTo("#halo-field", { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: "back.out(1.4)" }, 0.5);
      tl.to("#halo-spin", { rotation: -360, duration: 9.4, ease: "none" }, 0.6);
      tl.fromTo("#word-a", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.5)" }, 0.7);
      tl.fromTo("#word-b", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.4)" }, 1.1);
      tl.fromTo(".stat-dot", { scale: 0 }, { scale: 1, duration: 0.4, stagger: 0.12, ease: "back.out(2)" }, 1.8);
      tl.fromTo("#cta-lockup", { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 2.4);
`;

  return { style, body, animation };
}

function squareScene(px: (value: number) => number): { style: string; body: string; animation: string } {
  const style = `
      #rings-clip {
        z-index: 2;
      }

      #rings-field {
        position: absolute;
        top: ${px(190)}px;
        left: ${px(190)}px;
        width: ${px(700)}px;
        height: ${px(700)}px;
      }

      #ring-outer,
      #ring-inner,
      #ring-spin,
      #ring-counter {
        position: absolute;
        border-radius: 50%;
      }

      #ring-outer {
        inset: 0;
        border: ${Math.max(1, px(2))}px solid rgba(255, 247, 236, 0.34);
      }

      #ring-inner {
        inset: ${px(90)}px;
        border: ${Math.max(1, px(2))}px solid rgba(255, 107, 53, 0.55);
      }

      #ring-spin {
        inset: ${px(40)}px;
        border: ${Math.max(1, px(2))}px dashed rgba(101, 230, 207, 0.6);
      }

      #ring-counter {
        inset: ${px(150)}px;
        border: ${Math.max(1, px(2))}px dashed rgba(255, 209, 102, 0.6);
      }

      #title-clip {
        z-index: 3;
        text-align: center;
      }

      #word-a {
        position: absolute;
        top: ${px(400)}px;
        left: 0;
        right: 0;
        margin: 0;
        color: #ffd166;
        font-size: ${px(150)}px;
        font-weight: 900;
        letter-spacing: -0.05em;
        line-height: 1;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.55);
      }

      #rule {
        position: absolute;
        top: ${px(592)}px;
        left: calc(50% - ${px(160)}px);
        width: ${px(320)}px;
        height: ${px(12)}px;
        transform-origin: center;
        border-radius: 999px;
        background: #ff6b35;
        box-shadow: 0 0 ${px(26)}px rgba(255, 107, 53, 0.7);
      }

      #word-b {
        position: absolute;
        top: ${px(640)}px;
        left: 0;
        right: 0;
        margin: 0;
        color: #65e6cf;
        font-size: ${px(78)}px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1;
        text-shadow: 0 ${px(8)}px ${px(28)}px rgba(0, 0, 0, 0.55);
      }

      #promo-clip {
        z-index: 4;
      }

      #promo-caption {
        position: absolute;
        top: ${px(810)}px;
        left: 0;
        right: 0;
        color: #fff7ec;
        font-size: ${px(26)}px;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        text-align: center;
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.7);
      }`;

  const body = `      <div id="backdrop" class="clip backdrop" data-start="0" data-duration="10" data-track-index="0" aria-hidden="true"></div>

      <div id="rings-clip" class="clip" data-start="0" data-duration="10" data-track-index="1" aria-hidden="true">
        <div id="rings-field">
          <div id="ring-outer"></div>
          <div id="ring-inner"></div>
          <div id="ring-spin"></div>
          <div id="ring-counter"></div>
        </div>
      </div>

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-label="Título">
        <h1 id="word-a">PROMO</h1>
        <div id="rule"></div>
        <h2 id="word-b">QUADRADA</h2>
      </section>

      <section id="promo-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Chamada">
        <div id="promo-caption">Oferta em destaque</div>
      </section>`;

  const animation = `      tl.fromTo("#rings-field", { scale: 0.68, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.4)" }, 0.3);
      tl.to("#ring-spin", { rotation: 360, duration: 9.5, ease: "none" }, 0.4);
      tl.to("#ring-counter", { rotation: -360, duration: 9.5, ease: "none" }, 0.4);
      tl.fromTo("#word-a", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.8)" }, 0.8);
      tl.fromTo("#rule", { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.out" }, 1.2);
      tl.fromTo("#word-b", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 1.45);
      tl.fromTo("#promo-caption", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, 1.8);
`;

  return { style, body, animation };
}

type Scene = { style: string; body: string; animation: string; head?: string; script?: string };

const threeCdn = "https://cdn.jsdelivr.net/npm/three@0.186.0";

function threeImportMap(): string {
  return `
    <script type="importmap">
      {
        "imports": {
          "three": "${threeCdn}/build/three.module.js",
          "three/addons/": "${threeCdn}/examples/jsm/"
        }
      }
    </script>`;
}

function threeStageScript(options: {
  width: number;
  height: number;
  cameraZ: number;
  spin: number;
  parallax: number;
}): string {
  return `
    <script type="module">
      import * as THREE from "three";

      const width = ${options.width};
      const height = ${options.height};
      const canvas = document.getElementById("three-stage");
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, ${options.cameraZ});

      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.35, 5),
        new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.34, metalness: 0.22 }),
      );
      scene.add(core);

      const shell = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.045, 24, 128),
        new THREE.MeshStandardMaterial({ color: 0x65e6cf, roughness: 0.5, metalness: 0.15 }),
      );
      shell.rotation.x = Math.PI / 2.6;
      scene.add(shell);

      const lattice = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.9, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd166, wireframe: true, transparent: true, opacity: 0.34 }),
      );
      scene.add(lattice);

      scene.add(new THREE.HemisphereLight(0xfff7ec, 0x1a1430, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(4, 5, 6);
      scene.add(key);

      function renderAt(time) {
        core.rotation.y = time * ${options.spin};
        core.rotation.x = Math.sin(time * 0.6) * 0.2;
        shell.rotation.z = -time * ${options.spin * 0.7};
        lattice.rotation.y = -time * ${options.spin * 0.4};
        lattice.rotation.x = Math.sin(time * 0.45) * 0.35;
        camera.position.x = Math.sin(time * 0.5) * ${options.parallax};
        camera.position.y = Math.cos(time * 0.4) * ${options.parallax * 0.5};
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }

      window.addEventListener("hf-seek", (event) => {
        renderAt(event.detail.time);
      });

      renderAt(window.__hfThreeTime || 0);
    </script>`;
}

function threeStageMarkup(px: (value: number) => number, size: number): { style: string; body: string } {
  const style = `
      #three-stage {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: block;
        width: 100%;
        height: 100%;
      }

      #stage-glow {
        position: absolute;
        z-index: 2;
        top: 50%;
        left: 50%;
        width: ${px(size)}px;
        height: ${px(size)}px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(101, 230, 207, 0.16), rgba(16, 13, 23, 0) 68%);
        pointer-events: none;
      }

      #text-scrim {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(16, 13, 23, 0.78) 0%, rgba(16, 13, 23, 0) 34%),
          linear-gradient(0deg, rgba(16, 13, 23, 0.82) 0%, rgba(16, 13, 23, 0) 40%);
      }`;

  const body = `      <div id="backdrop" class="clip backdrop" data-start="0" data-duration="10" data-track-index="0" aria-hidden="true"></div>

      <div id="three-clip" class="clip" data-start="0" data-duration="10" data-track-index="1" aria-hidden="true">
        <canvas id="three-stage"></canvas>
        <div id="stage-glow"></div>
        <div id="text-scrim"></div>
      </div>`;

  return { style, body };
}

function landscape3dScene(px: (value: number) => number, width: number, height: number): Scene {
  const stage = threeStageMarkup(px, 760);
  const style = `${stage.style}

      #title-clip {
        z-index: 3;
      }

      .headline {
        position: absolute;
        left: ${px(126)}px;
        margin: 0;
        color: #fff7ec;
        font-weight: 900;
        line-height: 0.9;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.6);
        white-space: nowrap;
      }

      #word-a {
        top: ${px(350)}px;
        font-size: ${px(176)}px;
        letter-spacing: -0.06em;
      }

      #word-b {
        top: ${px(548)}px;
        font-size: ${px(104)}px;
        letter-spacing: -0.04em;
        color: #65e6cf;
      }

      #brand-clip {
        z-index: 4;
      }

      #brand-caption {
        position: absolute;
        top: ${px(560)}px;
        left: ${px(132)}px;
        color: #fff7ec;
        font-size: ${px(26)}px;
        font-weight: 800;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        padding: ${px(8)}px ${px(18)}px;
        border-radius: 999px;
        background: rgba(16, 13, 23, 0.62);
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.8);
      }

      #brand-lockup {
        position: absolute;
        top: ${px(400)}px;
        left: ${px(126)}px;
        color: #fff7ec;
        font-size: ${px(118)}px;
        font-weight: 900;
        letter-spacing: -0.07em;
        line-height: 1;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.56);
        white-space: nowrap;
      }

      #brand-lockup span {
        color: #ffa06b;
      }`;

  const body = `${stage.body}

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-label="Título">
        <h1 id="word-a" class="headline">DIMENSÃO</h1>
        <h2 id="word-b" class="headline">EM 3D</h2>
      </section>

      <section id="brand-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Marca">
        <div id="brand-lockup">DAIME <span>MOTION</span></div>
        <div id="brand-caption">Profundidade · Luz · Eixo Z</div>
      </section>`;

  const animation = `      tl.fromTo("#three-clip", { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, 0);
      tl.fromTo(
        "#word-a",
        { x: -90, y: 30, scale: 0.85, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.4)" },
        0.5,
      );
      tl.to("#word-a", { y: -24, opacity: 0, duration: 0.28, ease: "power2.in" }, 2.6);
      tl.fromTo("#word-b", { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 1);
      tl.to("#word-b", { x: 36, opacity: 0, duration: 0.28, ease: "power2.in" }, 3.4);
      tl.fromTo(
        "#brand-lockup",
        { x: -70, scale: 0.9, opacity: 0 },
        { x: 0, scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.35)" },
        4.2,
      );
      tl.fromTo("#brand-caption", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, 4.55);
`;

  return {
    style,
    body,
    animation,
    head: threeImportMap(),
    script: threeStageScript({ width, height, cameraZ: 6, spin: 0.7, parallax: 0.5 }),
  };
}

function portrait3dScene(px: (value: number) => number, width: number, height: number): Scene {
  const stage = threeStageMarkup(px, 720);
  const style = `${stage.style}

      #title-clip {
        z-index: 3;
        text-align: center;
      }

      .headline {
        position: absolute;
        left: 0;
        right: 0;
        margin: 0;
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: -0.05em;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.85), 0 0 ${px(60)}px rgba(0, 0, 0, 0.7);
      }

      #word-a {
        top: ${px(700)}px;
        color: #fff7ec;
        font-size: ${px(168)}px;
      }

      #word-b {
        top: ${px(900)}px;
        color: #fff7ec;
        font-size: ${px(104)}px;
      }

      #cta-clip {
        z-index: 4;
      }

      #cta-lockup {
        position: absolute;
        top: ${px(1560)}px;
        left: 0;
        right: 0;
        color: #fff7ec;
        font-size: ${px(30)}px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        text-align: center;
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.7);
      }`;

  const body = `${stage.body}

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-label="Título">
        <h1 id="word-a" class="headline">PROFUNDO</h1>
        <h2 id="word-b" class="headline">VERTICAL</h2>
      </section>

      <section id="cta-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Chamada">
        <div id="cta-lockup">Gire · Explore · Compartilhe</div>
      </section>`;

  const animation = `      tl.fromTo("#three-clip", { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, 0);
      tl.fromTo("#word-a", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.5)" }, 0.7);
      tl.fromTo("#word-b", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.4)" }, 1.1);
      tl.fromTo("#cta-lockup", { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 2.4);
`;

  return {
    style,
    body,
    animation,
    head: threeImportMap(),
    script: threeStageScript({ width, height, cameraZ: 6.4, spin: 0.55, parallax: 0.35 }),
  };
}

function square3dScene(px: (value: number) => number, width: number, height: number): Scene {
  const stage = threeStageMarkup(px, 640);
  const style = `${stage.style}

      #title-clip {
        z-index: 3;
        text-align: center;
      }

      #word-a {
        position: absolute;
        top: ${px(400)}px;
        left: 0;
        right: 0;
        margin: 0;
        color: #ffd166;
        font-size: ${px(150)}px;
        font-weight: 900;
        letter-spacing: -0.05em;
        line-height: 1;
        text-shadow: 0 ${px(10)}px ${px(34)}px rgba(0, 0, 0, 0.55);
      }

      #rule {
        position: absolute;
        top: ${px(592)}px;
        left: calc(50% - ${px(160)}px);
        width: ${px(320)}px;
        height: ${px(12)}px;
        transform-origin: center;
        border-radius: 999px;
        background: #ff6b35;
        box-shadow: 0 0 ${px(26)}px rgba(255, 107, 53, 0.7);
      }

      #word-b {
        position: absolute;
        top: ${px(640)}px;
        left: 0;
        right: 0;
        margin: 0;
        color: #65e6cf;
        font-size: ${px(78)}px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1;
        text-shadow: 0 ${px(8)}px ${px(28)}px rgba(0, 0, 0, 0.55);
      }

      #promo-clip {
        z-index: 4;
      }

      #promo-caption {
        position: absolute;
        top: ${px(810)}px;
        left: 0;
        right: 0;
        color: #fff7ec;
        font-size: ${px(26)}px;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        text-align: center;
        text-shadow: 0 ${px(3)}px ${px(18)}px rgba(0, 0, 0, 0.7);
      }`;

  const body = `${stage.body}

      <section id="title-clip" class="clip" data-start="0" data-duration="10" data-track-index="2" aria-label="Título">
        <h1 id="word-a">PROMO</h1>
        <div id="rule"></div>
        <h2 id="word-b">TRIDIMENSIONAL</h2>
      </section>

      <section id="promo-clip" class="clip" data-start="0" data-duration="10" data-track-index="3" aria-label="Chamada">
        <div id="promo-caption">Volume em destaque</div>
      </section>`;

  const animation = `      tl.fromTo("#three-clip", { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, 0);
      tl.fromTo("#word-a", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.8)" }, 0.8);
      tl.fromTo("#rule", { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.out" }, 1.2);
      tl.fromTo("#word-b", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 1.45);
      tl.fromTo("#promo-caption", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, 1.8);
`;

  return {
    style,
    body,
    animation,
    head: threeImportMap(),
    script: threeStageScript({ width, height, cameraZ: 6, spin: 0.65, parallax: 0.45 }),
  };
}

function sceneForFamily(
  family: LayoutFamily,
  id3d: boolean,
  px: (value: number) => number,
  width: number,
  height: number,
): Scene {
  if (id3d) {
    if (family === "portrait") return portrait3dScene(px, width, height);
    if (family === "square") return square3dScene(px, width, height);
    return landscape3dScene(px, width, height);
  }
  if (family === "portrait") return portraitScene(px);
  if (family === "square") return squareScene(px);
  return landscapeScene(px);
}

export function seedCompositionHtml(options: {
  templateId: string;
  name: string;
  resolution: string;
  frameRate: number;
}): string {
  const canvas = resolveCanvas(options.resolution, options.frameRate);
  const is3d = options.templateId.endsWith("-3d");
  const scene = sceneForFamily(canvas.family, is3d, canvas.px, canvas.width, canvas.height);
  const displayName = options.name.trim() || "Sem título";
  return compositionShell({
    width: canvas.width,
    height: canvas.height,
    fps: canvas.fps,
    family: canvas.family,
    title: `Daime Motion — ${displayName}`,
    label: `Motion graphics — ${displayName}`,
    style: scene.style,
    body: scene.body,
    animation: scene.animation,
    head: scene.head,
    script: scene.script,
  });
}

export async function seedProjectComposition(
  projectDirectory: string,
  options: { templateId: string; name: string; resolution: string; frameRate: number },
): Promise<void> {
  const html = seedCompositionHtml(options);
  await fs.writeFile(path.join(projectDirectory, "index.html"), html, "utf8");
}
