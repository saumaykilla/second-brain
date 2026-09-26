import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined))

const schema = z.object({
  MONGODB_URI: optional,
  MONGODB_DB: optional,
  OPENAI_API_KEY: optional,
  OPENROUTER_API_KEY: optional,
  SLACK_SIGNING_SECRET: optional,
  SLACK_BOT_TOKEN: optional,
  AWS_REGION: optional,
  EVIDENCE_BUCKET: optional,
  APP_URL: optional,
  DEFAULT_PROJECT_ID: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  NOTION_CLIENT_ID: optional,
  NOTION_CLIENT_SECRET: optional,
})

export type Env = z.infer<typeof schema>
export type EnvKey = keyof Env

export const REQUIRED_FOR_READY: EnvKey[] = ['MONGODB_URI']

export const REQUIRED_BY_FEATURE: Record<string, EnvKey[]> = {
  'f-a-01': ['OPENROUTER_API_KEY'],
  'f-a-02': ['OPENAI_API_KEY'],
  'f-a-06': ['SLACK_SIGNING_SECRET'],
  'f-a-08': ['AWS_REGION', 'EVIDENCE_BUCKET'],
  'f-b-01': ['OPENAI_API_KEY', 'OPENROUTER_API_KEY'],
  'f-b-05': ['SLACK_BOT_TOKEN'],
  'f-a-10': ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'],
}

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return schema.parse(source)
}

export function missingKeys(keys: EnvKey[], env: Env = readEnv()): EnvKey[] {
  return keys.filter((key) => !env[key])
}

export function dbName(env: Env = readEnv()): string {
  return env.MONGODB_DB ?? 'second-brain'
}

/**
 * Project every screen and API route uses when the request does not name one.
 * `orbit` is the sample fixture and is not the default for a real deployment.
 */
export function defaultProjectId(env: Env = readEnv()): string {
  return env.DEFAULT_PROJECT_ID ?? 'default'
}

/** Public origin of this app, used to build OAuth redirect URIs. */
export function appUrl(env: Env = readEnv()): string {
  return (env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}
