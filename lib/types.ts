// Shared shapes for both lanes. Changing this file requires agreement from
// both lanes, recorded in agent-progress.md (see AGENTS.md "Lanes").

export type MessageLabel = 'decision' | 'attempt_start' | 'attempt_result' | 'intent' | 'question' | 'noise'
export type MessageSource = 'slack' | 'web' | 'seed'

export interface Message {
  _id: string
  projectId: string
  source: MessageSource
  sourceId: string
  threadId: string
  author: string
  text: string
  postedAt: string
  label?: MessageLabel
}

export type BlockerType =
  | 'technical_limit'
  | 'cost'
  | 'performance'
  | 'library_bug'
  | 'licensing'
  | 'org_constraint'
  | 'time'

export type EvidenceKind = 'log' | 'benchmark' | 'pr' | 'commit' | 'slack_thread'

export interface Evidence {
  kind: EvidenceKind
  summary: string
  url?: string
}

export interface Blocker {
  type: BlockerType
  detail: string
  evidence: Evidence[]
}

export interface Condition {
  description: string
  met: boolean
  metByDecisionId?: string
}

export type AttemptOutcome = 'failed' | 'partially_worked' | 'abandoned'
export type AttemptStatus = 'active' | 'revisitable' | 'resolved'

export interface Attempt {
  _id: string
  projectId: string
  goal: string
  approach: string
  outcome: AttemptOutcome
  blockers: Blocker[]
  evidence: Evidence[]
  conditions: Condition[]
  alternative?: string
  hoursSpent: number
  authors: string[]
  sourceMessageIds: string[]
  entityIds: string[]
  status: AttemptStatus
  startedAt: string
  endedAt?: string
  embedding?: number[]
}

export type DecisionStatus = 'active' | 'superseded'

export interface Decision {
  _id: string
  projectId: string
  title: string
  rationale: string
  status: DecisionStatus
  supersededBy?: string
  authors: string[]
  sourceMessageIds: string[]
  entityIds: string[]
  decidedAt: string
  embedding?: number[]
}

export interface Entity {
  _id: string
  projectId: string
  name: string
  kind: 'technology' | 'service' | 'person' | 'feature'
}

export type EdgeKind = 'caused_by' | 'superseded_by' | 'alternative_to' | 'blocked_by' | 'unblocks'
export type NodeKind = 'attempt' | 'decision' | 'entity'

export interface Edge {
  _id: string
  projectId: string
  kind: EdgeKind
  from: { kind: NodeKind; id: string }
  to: { kind: NodeKind; id: string }
  explanation?: string
}

export interface Warning {
  _id: string
  projectId: string
  attemptId: string
  messageId?: string
  channel: 'slack' | 'web'
  confidence: number
  hoursSaved: number
  harnessVersion: number
  createdAt: string
}

export interface Feedback {
  _id: string
  projectId: string
  target: { kind: 'warning' | 'answer' | 'check'; id: string }
  verdict: 'helpful' | 'not_relevant'
  note?: string
  createdAt: string
}

export interface ModelRouting {
  classify: string
  extract: string
  judge: string
  reflect: string
  embed: string
}

export interface HarnessScores {
  deadEndPrecision: number
  deadEndRecall: number
  citationAccuracy: number
  staleness: number
  overall: number
}

export interface HarnessConfig {
  _id: string
  projectId: string
  version: number
  parentVersion?: number
  active: boolean
  prompts: { classify: string; extract: string; judge: string; answer: string; conditions: string }
  retrieval: { k: number; minScore: number; hybridWeight: number }
  mergeWindowDays: number
  routing: ModelRouting
  scores?: HarnessScores
  change?: string
  rejectedReason?: string
  createdAt: string
}

export interface Project {
  _id: string
  name: string
  description: string
}

export interface ProjectFixture {
  project: Project
  messages: Message[]
  attempts: Attempt[]
  decisions: Decision[]
  entities: Entity[]
  edges: Edge[]
  harness: HarnessConfig
  /** Optional demo-seed harness version history for the Lab/Impact screens. */
  harnessHistory?: HarnessConfig[]
  /** Optional demo-seed warnings so Impact shows real numbers without a database. */
  warnings?: Warning[]
}

// Contract results

export interface DeadEndMatch {
  attempt: Attempt
  confidence: number
  reason: string
  hoursSaved: number
}

export interface ConditionTransition {
  attemptId: string
  decisionId: string
  explanation: string
}

export interface IngestInput {
  projectId: string
  source: MessageSource
  sourceId: string
  threadId: string
  author: string
  text: string
  postedAt?: string
}

export interface IngestResult {
  message: Message
  label: MessageLabel
  duplicate: boolean
  attemptIds: string[]
  decisionIds: string[]
  transitions: ConditionTransition[]
}

// Knowledge documents: general project knowledge ingested from external sources
// (Notion pages, Slack messages, GitHub PRs/issues/commits) or seeded. This is
// what makes Second Brain more than a dead-end log: it is the searchable memory
// that Ask and the knowledge search read from, alongside attempts and decisions.

export type DocSource = 'notion' | 'slack' | 'github' | 'web' | 'seed'

export type DocKind =
  | 'note' // a Notion page / doc / wiki entry
  | 'message' // a Slack message or thread
  | 'pull_request'
  | 'issue'
  | 'commit'
  | 'comment'

export interface KnowledgeDoc {
  _id: string
  projectId: string
  source: DocSource
  kind: DocKind
  /** Stable id from the source system (Notion page id, Slack ts, PR number, sha). */
  sourceId: string
  title: string
  /** Full text content used for embedding and display. */
  text: string
  url?: string
  author?: string
  /** Freeform labels: repo name, channel, Notion database, tags. */
  tags?: string[]
  /** Related entity ids (technologies, services, people, features). */
  entityIds?: string[]
  createdAt: string
  /** When it was last updated in the source system. */
  updatedAt?: string
  /** When Second Brain ingested it. */
  ingestedAt: string
  embedding?: number[]
}

export const COLLECTIONS = [
  'projects',
  'messages',
  'attempts',
  'decisions',
  'entities',
  'edges',
  'documents',
  'warnings',
  'feedback',
  'harness_configs',
  'evals',
  'traces',
  'checkpoints',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]

export const EMBEDDING_DIMENSIONS = 1536
