import { readdirSync, readFileSync } from "node:fs";

const packageFiles = [
  "package.json",
  ...readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`),
];

const violations = packageFiles.flatMap((file) => {
  const packageJson = JSON.parse(readFileSync(file, "utf8"));
  return Object.keys(packageJson.dependencies ?? {}).map(
    (name) => `${file}: ${name}`,
  );
});

if (violations.length > 0) {
  console.error(
    "AGENTS.md forbids runtime dependencies before architecture approval:",
  );
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
