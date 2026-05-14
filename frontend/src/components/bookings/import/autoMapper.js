import { ALIAS_MAP } from "./fieldDefinitions";

// Normalise a column name for comparison: lowercase, no special chars, collapse spaces
function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Score how well a source column matches an app field's aliases
function score(sourceCol, aliases) {
  const src = normalise(sourceCol);
  for (const alias of aliases) {
    const a = normalise(alias);
    if (src === a) return 100;                          // exact
    if (src.includes(a) || a.includes(src)) return 70; // substring
    // word overlap
    const srcWords = new Set(src.split(" "));
    const aliasWords = a.split(" ");
    const overlap = aliasWords.filter((w) => srcWords.has(w)).length;
    if (overlap > 0 && (overlap / aliasWords.length) >= 0.6) return 40;
  }
  return 0;
}

// Returns { appFieldKey: sourceColumnName } — each source col used at most once
export function autoMapColumns(sourceColumns) {
  const mapping = {};
  const usedSources = new Set();

  // Build scored candidates for every app field
  const candidates = [];
  for (const [fieldKey, aliases] of Object.entries(ALIAS_MAP)) {
    for (const srcCol of sourceColumns) {
      const s = score(srcCol, aliases);
      if (s >= 40) candidates.push({ fieldKey, srcCol, score: s });
    }
  }

  // Greedy: sort by score desc, assign one source per app field and one app field per source
  candidates.sort((a, b) => b.score - a.score);
  const usedFields = new Set();

  for (const { fieldKey, srcCol } of candidates) {
    if (usedFields.has(fieldKey)) continue;
    if (usedSources.has(srcCol)) continue;
    mapping[fieldKey] = srcCol;
    usedFields.add(fieldKey);
    usedSources.add(srcCol);
  }

  return mapping;
}
