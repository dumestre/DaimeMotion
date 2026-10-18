import { describe, expect, it } from "vitest";
import path from "node:path";
import { PathSafetyError, resolveWithinDirectory, sanitizeFilename } from "../server/path-safety";

describe("local path safeguards", () => {
  it("accepts paths contained by the authorized project root", () => {
    const root = path.resolve("data", "projects", "example");
    expect(resolveWithinDirectory(root, path.join(root, "assets", "image.png"))).toBe(
      path.join(root, "assets", "image.png"),
    );
  });

  it("rejects parent traversal and sibling-prefix paths", () => {
    const root = path.resolve("data", "projects", "example");
    expect(() => resolveWithinDirectory(root, path.resolve(root, "..", "secret"))).toThrow(PathSafetyError);
    expect(() => resolveWithinDirectory(root, `${root}-outside`)).toThrow(PathSafetyError);
  });

  it("sanitizes filenames without preserving path separators", () => {
    const result = sanitizeFilename("..\\..\\take/one?.mp4");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result).not.toMatch(/^\.+/);
  });
});
