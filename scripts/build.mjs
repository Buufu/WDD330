import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(path.join(projectRoot, "index.html"), path.join(outputDirectory, "index.html"));
await cp(path.join(projectRoot, "watchlist.html"), path.join(outputDirectory, "watchlist.html"));
await cp(path.join(projectRoot, "css"), path.join(outputDirectory, "css"), { recursive: true });
await cp(path.join(projectRoot, "js"), path.join(outputDirectory, "js"), { recursive: true });

console.log(`Static site built at ${outputDirectory}`);
