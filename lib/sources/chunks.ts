// Split a file or page into overlapping chunks for embedding (f-a-10).

export const CHUNK_CHARS = 1200
export const CHUNK_OVERLAP = 150
export const MAX_CHUNKS_PER_DOC = 40

export function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]
  const chunks: string[] = []
  let start = 0
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    let end = Math.min(clean.length, start + size)
    if (end < clean.length) {
      const breakAt = clean.lastIndexOf('\n', end)
      if (breakAt > start + size / 2) end = breakAt
    }
    chunks.push(clean.slice(start, end).trim())
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks.filter(Boolean)
}
