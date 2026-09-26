import { MongoClient, type Collection, type Db, type Document } from 'mongodb'
import { dbName, readEnv } from './env'
import type {
  Attempt,
  CollectionName,
  Decision,
  Edge,
  Entity,
  Feedback,
  HarnessConfig,
  KnowledgeDoc,
  Message,
  Project,
  Warning,
} from './types'

const globalForMongo = globalThis as unknown as { __mongoClient?: Promise<MongoClient> }

export function isDbConfigured(): boolean {
  return Boolean(readEnv().MONGODB_URI)
}

export function getClient(): Promise<MongoClient> {
  const uri = readEnv().MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (!globalForMongo.__mongoClient) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, appName: 'second-brain' })
    globalForMongo.__mongoClient = client.connect().catch((error) => {
      globalForMongo.__mongoClient = undefined
      throw error
    })
  }
  return globalForMongo.__mongoClient
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(dbName())
}

export async function closeDb(): Promise<void> {
  const pending = globalForMongo.__mongoClient
  globalForMongo.__mongoClient = undefined
  if (pending) await (await pending).close()
}

interface CollectionTypes {
  projects: Project
  messages: Message
  attempts: Attempt
  decisions: Decision
  entities: Entity
  edges: Edge
  documents: KnowledgeDoc
  warnings: Warning
  feedback: Feedback
  harness_configs: HarnessConfig
  evals: Document & { _id: string }
  traces: Document
  checkpoints: Document
}

export async function collection<N extends CollectionName>(name: N): Promise<Collection<CollectionTypes[N]>> {
  return (await getDb()).collection<CollectionTypes[N]>(name)
}
