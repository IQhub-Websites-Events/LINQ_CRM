/**
 * wire_probe.mjs — captures what the REAL frontend api/*.js modules put on the
 * wire, and asserts the invariants that two shipped bugs violated.
 *
 * Run by accounts/tests_wire_probe.py, which shells `node` and then replays the
 * captured literals against Django. Kept as a .mjs beside the test rather than
 * in the frontend tree because it is test tooling, not shipped code.
 *
 * No dependencies: axios is stubbed, React imports are stripped, and the
 * modules are imported from a temp directory.
 *
 * Output: a single JSON document on stdout.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const FE = resolve(process.argv[2] ?? "../frontend/src");
const dir = mkdtempSync(join(tmpdir(), "wire-"));
const captured = [];
globalThis.__CAP = captured;

const AXIOS_STUB = `
const __mk = () => ({
  get:    (url, cfg) => { globalThis.__CAP.push({ verb:"GET",  url, params: cfg?.params ?? null, body: null }); return Promise.resolve({ data: {} }); },
  post:   (url, body) => { globalThis.__CAP.push({ verb:"POST", url, params: null, body: JSON.parse(JSON.stringify(body ?? null)) }); return Promise.resolve({ data: {} }); },
  patch:  () => Promise.resolve({ data: {} }),
  delete: () => Promise.resolve({ data: {} }),
  interceptors: { request: { use(){} }, response: { use(){} } },
});
const axios = { create: __mk };
`;

async function load(rel, extra = (s) => s) {
  const src = extra(readFileSync(join(FE, rel), "utf8"))
    .replace(/^import axios from "axios";$/m, AXIOS_STUB)
    .replace(/process\.env\.REACT_APP_API_URL/g, "undefined")
    .replace(/^import .*from "react";$/m, "");
  const p = join(dir, rel.replace(/[\\/]/g, "_").replace(/\.jsx?$/, ".mjs"));
  writeFileSync(p, src);
  return import("file://" + p.replace(/\\/g, "/"));
}

// api/*.js import "./client" — resolve that to the stubbed copy we just wrote.
const clientMod = await load("api/client.js");
const clientPath = join(dir, "api_client.mjs").replace(/\\/g, "/");
const patchClientImport = (s) =>
  s.replace(/from "\.\/client"/g, `from "file://${clientPath}"`);

const { serializeParams } = clientMod;
const hook = await load("hooks/useFilterSpec.js");
const { buildCriterion, specToJson } = hook;

const delegates = (await load("api/delegates.js", patchClientImport)).delegatesApi;
const tickets = (await load("api/ticketCentral.js", patchClientImport)).ticketCentralApi;
const events = (await load("api/events.js", patchClientImport)).eventsApi;

const results = { checks: [], literals: {} };
const check = (name, pass, detail = "") =>
  results.checks.push({ name, pass, detail });

// ── 1. A filtered list request, per module ──────────────────────────────────
const criteria = [
  buildCriterion("ticket_tier", "is_empty", undefined),
  buildCriterion("payment_status", "none_of", ["Paid", "Cancelled"]),
];
const specJson = specToJson(criteria);

check("specToJson returns raw JSON, not pre-encoded",
  !specJson.includes("%"), specJson.slice(0, 40));

const listQuery = serializeParams({
  page: 1, page_size: 50, ordering: "-_sort_request_date", filter_spec: specJson,
});
results.literals.delegates_list_query = listQuery;

const specOccurrences = (listQuery.match(/filter_spec=/g) || []).length;
check("filter_spec appears exactly once", specOccurrences === 1, `${specOccurrences}`);
check("filter_spec is single-encoded (no %25)", !listQuery.includes("%25"),
  listQuery.includes("%25") ? "found %25 — double encoded" : "ok");

const specValue = new URLSearchParams(listQuery).get("filter_spec");
let parsed = null;
try { parsed = JSON.parse(specValue); } catch { /* left null */ }
check("one decode yields parseable JSON", parsed !== null);
check("is_empty criterion carries no value key",
  parsed && !("value" in parsed.criteria[0]) && !("values" in parsed.criteria[0]),
  parsed ? Object.keys(parsed.criteria[0]).join(",") : "unparsed");

// ── 2. bulkUpdate per module: ids must be a JSON array ──────────────────────
for (const [name, api] of [["delegates", delegates], ["tickets", tickets], ["events", events]]) {
  captured.length = 0;
  await api.bulkUpdate([1, 2, 3], "status", "X", true, "hash");
  const sent = captured[captured.length - 1];
  results.literals[`${name}_bulk_update_body`] = sent.body;
  check(`${name}.bulkUpdate ids is a JSON array`,
    Array.isArray(sent.body.ids), JSON.stringify(sent.body.ids));
  check(`${name}.bulkUpdate ids is not {}`,
    JSON.stringify(sent.body.ids) !== "{}", JSON.stringify(sent.body.ids));
}

// ── 3. A Set must THROW, never serialise to {} ──────────────────────────────
for (const [name, api] of [["delegates", delegates], ["tickets", tickets], ["events", events]]) {
  let threw = false, msg = "";
  try { await api.bulkUpdate(new Set([1, 2]), "status", "X", true, "h"); }
  catch (e) { threw = true; msg = e.message; }
  check(`${name}.bulkUpdate rejects a Set loudly`, threw, msg);
}
for (const [name, api] of [["delegates", delegates], ["tickets", tickets]]) {
  let threw = false;
  try { await api.bulkDelete(new Set([1])); } catch { threw = true; }
  check(`${name}.bulkDelete rejects a Set loudly`, threw);
}

// ── 4. A value-less preview omits the key entirely ──────────────────────────
captured.length = 0;
await delegates.bulkUpdate([1], "status", undefined, false, null);
const preview = captured[captured.length - 1].body;
check("value-less preview omits the value key", !("value" in preview),
  Object.keys(preview).join(","));

results.pass = results.checks.every((c) => c.pass);
process.stdout.write(JSON.stringify(results, null, 2));
