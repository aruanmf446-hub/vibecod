// Identifica qual código está rodando, para comparar o servidor da live com o GitHub.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Arquivos que mudam o comportamento do jogo. Documentação e testes ficam de fora.
const CODE = ["server.mjs", "battle.mjs", "version.mjs", "package.json", "public"];

function files(root, entry) {
  const full = path.join(root, entry);
  if (!statSync(full, { throwIfNoEntry: false })) return [];
  if (!statSync(full).isDirectory()) return [entry];
  return readdirSync(full).sort().flatMap(name => files(root, path.posix.join(entry, name)));
}

// Impressão digital do código: igual no Windows (CRLF) e no Linux (LF).
export function codeFingerprint(root) {
  const hash = createHash("sha256");
  for (const file of CODE.flatMap(entry => files(root, entry)).sort()) {
    hash.update(file + "\n");
    hash.update(readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 12);
}

function gitCommit(root) {
  const fromHost = process.env.COMMIT_SHA || process.env.RENDER_GIT_COMMIT ||
    process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_VERSION;
  if (fromHost) return String(fromHost).slice(0, 40);
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    return null; // Pasta baixada como ZIP: sem .git, use a impressão digital.
  }
}

export function buildInfo(root) {
  return {
    commit: gitCommit(root),
    fingerprint: codeFingerprint(root),
    startedAt: new Date().toISOString(),
    node: process.version
  };
}
