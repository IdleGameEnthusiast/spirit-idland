/* Loads the engine for node, the way a browser loads it.
 *
 * The engine is a set of classic scripts that share one global scope: a top-level `const`
 * in engine/constants.js is visible from engine/combat.js with no import anywhere. node's
 * module system does not work that way, so instead of requiring each file we concatenate
 * them in page order and run the result as one script in a fresh vm context. That is the
 * same scope the browser gives them, so the tests exercise the real arrangement.
 *
 * The load order is not written here. It is read out of index.html, which is the one place
 * the game itself declares it - so this file cannot drift from what ships. tests.html is
 * checked against the same list by tests/modules.test.js. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* The <script src> values between the engine:start and engine:end markers of a page. */
function engineScriptList(page) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const start = html.indexOf("engine:start");
  const end = html.indexOf("engine:end");
  if (start < 0 || end < 0) throw new Error(`${page}: engine:start/engine:end markers not found`);

  const block = html.slice(start, end);
  const files = [];
  const tag = /<script\s+src="([^"]+)"><\/script>/g;
  let match;
  while ((match = tag.exec(block))) files.push(match[1]);
  if (!files.length) throw new Error(`${page}: no engine scripts between the markers`);
  return files;
}

function loadEngine() {
  const files = engineScriptList("index.html");
  // A newline and a semicolon between files: neither is needed by the current sources, but
  // concatenation should not be able to weld the last statement of one file onto the first
  // of the next.
  const source = files
    .map((file) => `\n/* ${file} */\n` + fs.readFileSync(path.join(ROOT, file), "utf8"))
    .join("\n;\n");

  // Buffer is the one host global the engine reaches for - save export encodes through it
  // when there is no btoa. Everything else it uses is a standard intrinsic.
  const sandbox = { module: { exports: {} }, Buffer, console };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: "engine (concatenated)" }).runInContext(sandbox);

  const engine = sandbox.module.exports;
  if (!engine || !engine.createInitialState) {
    throw new Error("engine loaded but the export shim did not run");
  }
  return engine;
}

module.exports = { engine: loadEngine(), engineScriptList };
