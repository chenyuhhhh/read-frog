import type { SelectionToolbarCustomAction, SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { browser } from "#imports"
import { liveQuery } from "dexie"
import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"

export interface VocabularyEntryCandidate {
  key: string
  term: string
  normalizedTerm: string
  phonetic: string
  partOfSpeech: string
  definition: string
  context: string
  contextTranslation: string
  difficulty: string
  selectionText: string
  sourceUrl: string
  sourceTitle: string
  sourceCode: string
  targetCode: string
}

export interface DictionaryVocabularyFields {
  term: string
  phonetic: string
  partOfSpeech: string
  definition: string
  context: string
  contextTranslation: string
  difficulty: string
}

export const VOCABULARY_ENTRIES_QUERY_KEY = ["vocabulary-entries"] as const
const VOCABULARY_ENTRIES_STORAGE_KEY = "vocabularyEntries"

type StoredVocabularyEntry = VocabularyEntryCandidate & {
  createdAt: string
  updatedAt: string
}

let legacyMigrationPromise: Promise<void> | null = null

export function getVocabularyEntryQueryKey(key: string) {
  return ["vocabulary-entry", key] as const
}

interface BuildVocabularyEntryCandidateInput {
  action: SelectionToolbarCustomAction
  result: Record<string, unknown> | null
  selectionText: string | null | undefined
  sourceCode: string
  sourceTitle: string
  sourceUrl: string
  targetCode: string
}

const DEFAULT_DICTIONARY_ACTION_ID = "default-dictionary"

const DICTIONARY_FIELD_SUFFIXES = {
  term: "dictionary-term",
  phonetic: "dictionary-phonetic",
  partOfSpeech: "dictionary-part-of-speech",
  definition: "dictionary-definition",
  context: "dictionary-context",
  contextTranslation: "dictionary-context-translation",
  difficulty: "dictionary-difficulty",
} as const

function getDictionaryField(
  action: SelectionToolbarCustomAction,
  suffix: string,
): SelectionToolbarCustomActionOutputField | null {
  return action.outputSchema.find(field => field.id === suffix || field.id.endsWith(`-${suffix}`)) ?? null
}

function readFieldValue(
  action: SelectionToolbarCustomAction,
  result: Record<string, unknown>,
  suffix: string,
): string {
  const field = getDictionaryField(action, suffix)
  if (!field) {
    return ""
  }

  const value = result[field.name]
  if (value === null || value === undefined) {
    return ""
  }

  return typeof value === "string" ? value.trim() : String(value).trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function toVocabularyEntry(entry: StoredVocabularyEntry | VocabularyEntry): VocabularyEntry {
  const fallbackDate = new Date()
  return {
    ...entry,
    createdAt: toDate(entry.createdAt, fallbackDate),
    updatedAt: toDate(entry.updatedAt, fallbackDate),
  } as VocabularyEntry
}

function sortVocabularyEntries(entries: VocabularyEntry[]): VocabularyEntry[] {
  return [...entries].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

function toDate(value: Date | string | undefined, fallback: Date): Date {
  const date = value instanceof Date
    ? value
    : value ? new Date(value) : fallback

  return Number.isNaN(date.getTime()) ? fallback : date
}

async function getLegacyStoredVocabularyEntries(): Promise<Record<string, StoredVocabularyEntry>> {
  const result = await browser.storage.local.get(VOCABULARY_ENTRIES_STORAGE_KEY)
  const entries = result[VOCABULARY_ENTRIES_STORAGE_KEY]

  return isRecord(entries)
    ? entries as Record<string, StoredVocabularyEntry>
    : {}
}

async function removeLegacyStoredVocabularyEntries(): Promise<void> {
  await browser.storage.local.remove(VOCABULARY_ENTRIES_STORAGE_KEY)
}

async function migrateLegacyVocabularyEntriesToDexie(): Promise<void> {
  const legacyEntries = Object.values(await getLegacyStoredVocabularyEntries()).map(toVocabularyEntry)
  if (legacyEntries.length === 0) {
    await removeLegacyStoredVocabularyEntries()
    return
  }

  await db.transaction("rw", db.vocabularyEntries, async () => {
    for (const legacyEntry of legacyEntries) {
      const existingEntry = await db.vocabularyEntries.get(legacyEntry.key)
      if (existingEntry && existingEntry.updatedAt.getTime() > legacyEntry.updatedAt.getTime()) {
        continue
      }

      await db.vocabularyEntries.put(legacyEntry)
    }
  })
  await removeLegacyStoredVocabularyEntries()
}

async function ensureLegacyVocabularyEntriesMigrated(): Promise<void> {
  legacyMigrationPromise ??= migrateLegacyVocabularyEntriesToDexie()
    .catch((error) => {
      legacyMigrationPromise = null
      throw error
    })
  await legacyMigrationPromise
}

async function listVocabularyEntriesFromDexie(): Promise<VocabularyEntry[]> {
  return sortVocabularyEntries((await db.vocabularyEntries.toArray()).map(toVocabularyEntry))
}

export function normalizeVocabularyTerm(term: string): string {
  return term.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

export function buildVocabularyEntryKey({
  normalizedTerm,
  sourceCode,
  targetCode,
}: {
  normalizedTerm: string
  sourceCode: string
  targetCode: string
}): string {
  return `${normalizedTerm}|${sourceCode}|${targetCode}`
}

export function isDictionaryCustomAction(action: SelectionToolbarCustomAction): boolean {
  if (action.id === DEFAULT_DICTIONARY_ACTION_ID) {
    return true
  }

  return !!getDictionaryField(action, DICTIONARY_FIELD_SUFFIXES.term)
    && !!getDictionaryField(action, DICTIONARY_FIELD_SUFFIXES.definition)
}

export function extractDictionaryVocabularyFields(
  action: SelectionToolbarCustomAction,
  result: Record<string, unknown> | null,
): DictionaryVocabularyFields | null {
  if (!result || !isDictionaryCustomAction(action)) {
    return null
  }

  const fields = {
    term: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.term),
    phonetic: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.phonetic),
    partOfSpeech: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.partOfSpeech),
    definition: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.definition),
    context: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.context),
    contextTranslation: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.contextTranslation),
    difficulty: readFieldValue(action, result, DICTIONARY_FIELD_SUFFIXES.difficulty),
  }

  return fields.term ? fields : null
}

export function buildVocabularyEntryCandidate({
  action,
  result,
  selectionText,
  sourceCode,
  sourceTitle,
  sourceUrl,
  targetCode,
}: BuildVocabularyEntryCandidateInput): VocabularyEntryCandidate | null {
  const fields = extractDictionaryVocabularyFields(action, result)
  if (!fields) {
    return null
  }

  const normalizedTerm = normalizeVocabularyTerm(fields.term)
  if (!normalizedTerm) {
    return null
  }

  const key = buildVocabularyEntryKey({
    normalizedTerm,
    sourceCode,
    targetCode,
  })

  return {
    key,
    ...fields,
    normalizedTerm,
    selectionText: selectionText?.trim() ?? "",
    sourceCode,
    sourceTitle,
    sourceUrl,
    targetCode,
  }
}

export async function findVocabularyEntry(key: string): Promise<VocabularyEntry | undefined> {
  await ensureLegacyVocabularyEntriesMigrated()
  const entry = await db.vocabularyEntries.get(key)
  return entry ? toVocabularyEntry(entry) : undefined
}

export async function upsertVocabularyEntry(candidate: VocabularyEntryCandidate): Promise<VocabularyEntry> {
  await ensureLegacyVocabularyEntriesMigrated()
  return await db.transaction("rw", db.vocabularyEntries, async () => {
    const existing = await db.vocabularyEntries.get(candidate.key)
    const now = new Date()
    const entry = {
      ...candidate,
      createdAt: existing ? toDate(existing.createdAt, now) : now,
      updatedAt: now,
    } as VocabularyEntry

    await db.vocabularyEntries.put(entry)
    return entry
  })
}

export async function removeVocabularyEntry(key: string): Promise<void> {
  await ensureLegacyVocabularyEntriesMigrated()
  await db.vocabularyEntries.delete(key)
}

export async function listVocabularyEntries(): Promise<VocabularyEntry[]> {
  await ensureLegacyVocabularyEntriesMigrated()
  return await listVocabularyEntriesFromDexie()
}

export async function observeVocabularyEntries(
  onEntries: (entries: VocabularyEntry[]) => void,
): Promise<{ unsubscribe: () => void }> {
  await ensureLegacyVocabularyEntriesMigrated()
  const subscription = liveQuery(listVocabularyEntriesFromDexie)
    .subscribe({
      next: onEntries,
      error: error => logger.error("[VocabularyNotebook] Failed to observe entries:", error),
    })

  return {
    unsubscribe: () => subscription.unsubscribe(),
  }
}
