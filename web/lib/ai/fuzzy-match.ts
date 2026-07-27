// Port từ api/fuzzy_match.py — Jaccard Token Similarity, không dùng thư viện ngoài.

const UNIT_MAP: [RegExp, string][] = [
  [/\bmilimét\b/gi, "mm"],
  [/\bm\.?m\b/gi, "mm"],
  [/\bmét\b/gi, "m"],
  [/\bcm\b/gi, "cm"],
  [/\bkilogam\b/gi, "kg"],
  [/\bký\b/gi, "kg"],
  [/\bkilo\b/gi, "kg"],
  [/\btấn\b/gi, "t"],
  [/\bm2\b/gi, "m2"],
  [/\bm²\b/gi, "m2"],
  [/\bm\^2\b/gi, "m2"],
  [/\blít\b/gi, "l"],
  [/\blit\b/gi, "l"],
];

const PUNCT = /[/\\()[\]{}<>:;,!?@#$%^&*+=|`~]/g;
const SPACES = /\s+/g;

/** Bỏ dấu tiếng Việt và diacritic Unicode — tương đương unicodedata.normalize('NFKD') + strip combining marks. */
export function removeDiacritics(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normalize(text: string): string {
  if (!text) return "";
  let s = removeDiacritics(text).toLowerCase();

  for (const [pattern, replacement] of UNIT_MAP) {
    s = s.replace(pattern, replacement);
  }

  // "0,35" hoặc "0.35" → "0 35"
  s = s.replace(/(\d)[.,](\d)/g, "$1 $2");

  s = s.replace(PUNCT, " ");

  // Gạch ngang giữa chữ → khoảng trắng
  s = s.replace(/(?<=\s)-|-(?=\s)/g, " ");
  s = s.replace(/-/g, " ");

  // Xóa ký tự không phải alphanumeric/khoảng trắng (giữ ký tự Unicode chữ cái còn lại)
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");

  s = s.replace(SPACES, " ").trim();
  return s;
}

export function tokenize(text: string): Set<string> {
  return new Set(text.split(" ").filter((t) => t.length > 1));
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

export function fuzzyScore(textA: string, textB: string): number {
  const na = normalize(textA);
  const nb = normalize(textB);
  if (na === nb) return 100;

  const ta = tokenize(na);
  const tb = tokenize(nb);
  let score = jaccardSimilarity(ta, tb) * 100;

  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  if (wordsA.length && wordsB.length && wordsA[0] === wordsB[0]) {
    score = Math.min(100, score + 5);
  }
  return Math.round(score);
}

export function findBestMatch<T extends Record<string, unknown>>(
  query: string,
  candidates: T[],
  textField: keyof T,
  scoreThreshold = 0,
): { item: T; score: number } | null {
  if (!candidates.length || !query) return null;

  let bestItem: T | null = null;
  let bestScore = -1;

  for (const item of candidates) {
    const candidateText = item[textField];
    if (!candidateText) continue;
    const score = fuzzyScore(query, String(candidateText));
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem === null || bestScore < scoreThreshold) return null;
  return { item: bestItem, score: bestScore };
}

export function classifyTab(score: number, greenThreshold: number, yellowThreshold: number): "green" | "yellow" | "red" {
  if (score >= greenThreshold) return "green";
  if (score >= yellowThreshold) return "yellow";
  return "red";
}
