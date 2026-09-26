// One OpenRouter chat call for the ingest pipeline (f-a-01, f-a-02). The model
// and system prompt come from the active harness (R35); nothing is hard-coded.

import { readEnv } from '../env'

export function modelConfigured(): boolean {
  return Boolean(readEnv().OPENROUTER_API_KEY)
}

export async function chat(model: string, system: string, user: string, json: boolean): Promise<string> {
  const key = readEnv().OPENROUTER_API_KEY
  if (!key) throw new Error('model_not_configured')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`model_failed: ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/** Pull the first JSON object out of a model reply, tolerating code fences. */
export function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('model_returned_no_json')
  }
}
