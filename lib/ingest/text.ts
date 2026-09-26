const STOP = new Set('a an and the to of for on in with so we our is it be get got add use using from that this all team will instead moving move switch switching decided decision tried trying going about must not'.split(' '))

/** Meaningful lower-case tokens of a text, for lexical overlap checks. */
export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+.]+/)
      .map((w) => w.replace(/\.$/, ''))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}
