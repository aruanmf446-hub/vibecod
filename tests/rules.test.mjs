import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
test("regras de flor e rosa existem", () => {
  assert.match(source, /function teamFromGift/);
  assert.match(source, /flower/);
  assert.match(source, /rose/);
});
test("simulador é limitado a localhost", () => {
  assert.match(source, /function isLocal/);
  assert.match(source, /status\(403\)/);
});
test("jogo não conecta se username estiver vazio", () => {
  assert.match(source, /if \(!USERNAME\)/);
});
