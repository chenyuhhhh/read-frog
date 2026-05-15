import type { SelectionToolbarCustomAction, SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { browser } from "#imports"
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

function toStoredEntry(entry: VocabularyEntry): StoredVocabularyEntry {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function toVocabularyEntry(entry: StoredVocabularyEntry): VocabularyEntry {
  return {
    ...entry,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  } as VocabularyEntry
}

function sortVocabularyEntries(entries: VocabularyEntry[]): VocabularyEntry[] {
  return [...entries].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

async function getStoredVocabularyEntries(): Promise<Record<string, StoredVocabularyEntry>> {
  const result = await browser.storage.local.get(VOCABULARY_ENTRIES_STORAGE_KEY)
  const entries = result[VOCABULARY_ENTRIES_STORAGE_KEY]

  return isRecord(entries)
    ? entries as Record<string, StoredVocabularyEntry>
    : {}
}

async function setStoredVocabularyEntries(entries: Record<string, StoredVocabularyEntry>): Promise<void> {
  await browser.storage.local.set({
    [VOCABULARY_ENTRIES_STORAGE_KEY]: entries,
  })
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
  const entries = await getStoredVocabularyEntries()
  const entry = entries[key]
  return entry ? toVocabularyEntry(entry) : undefined
}

export async function upsertVocabularyEntry(candidate: VocabularyEntryCandidate): Promise<VocabularyEntry> {
  const entries = await getStoredVocabularyEntries()
  const existing = entries[candidate.key]
  const now = new Date()
  const entry = {
    ...candidate,
    createdAt: existing ? new Date(existing.createdAt) : now,
    updatedAt: now,
  } as VocabularyEntry

  await setStoredVocabularyEntries({
    ...entries,
    [entry.key]: toStoredEntry(entry),
  })
  return entry
}

export async function removeVocabularyEntry(key: string): Promise<void> {
  const entries = await getStoredVocabularyEntries()
  delete entries[key]
  await setStoredVocabularyEntries(entries)
}

export async function listVocabularyEntries(): Promise<VocabularyEntry[]> {
  const entries = await getStoredVocabularyEntries()
  return sortVocabularyEntries(Object.values(entries).map(toVocabularyEntry))
}

export async function observeVocabularyEntries(
  onEntries: (entries: VocabularyEntry[]) => void,
): Promise<{ unsubscribe: () => void }> {
  const listener = (
    changes: Record<string, { newValue?: unknown, oldValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== "local") {
      return
    }

    const change = changes[VOCABULARY_ENTRIES_STORAGE_KEY]
    if (!change) {
      return
    }

    try {
      const entries = isRecord(change.newValue)
        ? Object.values(change.newValue as Record<string, StoredVocabularyEntry>).map(toVocabularyEntry)
        : []
      onEntries(sortVocabularyEntries(entries))
    }
    catch (error) {
      logger.error("[VocabularyNotebook] Failed to observe entries:", error)
    }
  }

  browser.storage.onChanged.addListener(listener)

  return {
    unsubscribe: () => browser.storage.onChanged.removeListener(listener),
  }
}
