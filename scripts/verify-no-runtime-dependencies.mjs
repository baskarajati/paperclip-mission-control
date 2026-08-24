import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageFiles = [
  join(root, "package.json"),
  ...readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, `packages/${entry.name}/package.json`)),
];

// These are all package.json fields that can make a package depend on a
// runtime package. `devDependencies` is intentionally absent: it is tooling
// only for this milestone and is checked separately by package verification.
const runtimeDependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
  "bundleDependencies",
];

const violations = packageFiles.flatMap((file) => {
  const packageJson = JSON.parse(readFileSync(file, "utf8"));
  return runtimeDependencyFields.flatMap((field) => {
    const value = packageJson[field];
    if (value === undefined) return [];
    if (Array.isArray(value)) {
      return value.map((name) => `${file}: ${field}.${name}`);
    }
    if (value !== null && typeof value === "object") {
      return Object.keys(value).map((name) => `${file}: ${field}.${name}`);
    }
    return [`${file}: ${field} (must be empty)`];
  });
});

if (violations.length > 0) {
  console.error(
    "AGENTS.md forbids runtime dependencies before architecture approval:",
  );
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
