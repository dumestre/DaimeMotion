import path from "node:path";

export class PathSafetyError extends Error {}

export function resolveWithinDirectory(parent: string, candidate: string): string {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  if (target === root || target.startsWith(`${root}${path.sep}`)) return target;
  throw new PathSafetyError("O caminho solicitado está fora da pasta autorizada.");
}

export function sanitizeFilename(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
}
