export interface Chunk {
  id: string;
  sourceId: string;
  sourceName: string;
  text: string;
}

export function chunkSource(source: any): Chunk[] {
  const paragraphs = source.content.split(/\n\s*\n+/);
  const chunks: Chunk[] = [];
  let chunkCounter = 0;
  const sourceId = source._id ? source._id.toString() : source.id;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= 800) {
      chunks.push({
        id: `${sourceId}-${chunkCounter++}`,
        sourceId,
        sourceName: source.name,
        text: trimmed,
      });
    } else {
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      let currentSegment = "";

      for (const sentence of sentences) {
        if ((currentSegment + " " + sentence).length > 800) {
          if (currentSegment.trim()) {
            chunks.push({
              id: `${sourceId}-${chunkCounter++}`,
              sourceId,
              sourceName: source.name,
              text: currentSegment.trim(),
            });
          }
          const words = currentSegment.split(" ");
          currentSegment = words.slice(-12).join(" ") + " " + sentence;
        } else {
          currentSegment = currentSegment
            ? currentSegment + " " + sentence
            : sentence;
        }
      }
      if (currentSegment.trim()) {
        chunks.push({
          id: `${sourceId}-${chunkCounter++}`,
          sourceId,
          sourceName: source.name,
          text: currentSegment.trim(),
        });
      }
    }
  }
  return chunks;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "at",
  "from", "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "in", "on", "of", "is",
  "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "i", "you", "he", "she", "it", "we",
  "they", "what", "which", "who", "whom", "this", "that", "these", "those", "as",
  "until", "while", "can", "could", "will", "would", "should", "how", "why",
  "where", "here", "there",
]);

export function retrieveRelevantChunks(
  query: string,
  sources: any[],
  limit = 6
): Chunk[] {
  const allChunks: Chunk[] = [];
  for (const source of sources) {
    allChunks.push(...chunkSource(source));
  }

  if (allChunks.length === 0) return [];

  const terms = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  if (terms.length === 0) {
    const fallbacks = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (fallbacks.length === 0) return allChunks.slice(0, limit);
    terms.push(...fallbacks);
  }

  const scoredChunks = allChunks.map((chunk) => {
    const chunkTextLower = chunk.text.toLowerCase();
    let score = 0;
    terms.forEach((term) => {
      const wordRegex = new RegExp("\\b" + term + "\\b", "g");
      const wordMatches = chunkTextLower.match(wordRegex);
      if (wordMatches) {
        score += wordMatches.length * 4;
      } else if (chunkTextLower.includes(term)) {
        score += 0.8;
      }
    });
    return { chunk, score };
  });

  const filtered = scoredChunks.filter((item) => item.score > 0);
  if (filtered.length === 0) return allChunks.slice(0, Math.min(3, allChunks.length));

  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}
