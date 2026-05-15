import type { VocabularyEntryCandidate } from "../vocabulary-notebook"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildVocabularyEntryCandidate,
  buildVocabularyEntryKey,
  extractDictionaryVocabularyFields,
  isDictionaryCustomAction,
  normalizeVocabularyTerm,
} from "../vocabulary-notebook"

const mocks = vi.hoisted(() => {
  const vocabularyEntries = new Map<string, VocabularyEntry>()
  const legacyStorage = new Map<string, unknown>()

  return {
    legacyStorage,
    vocabularyEntries,
    db: {
      transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<unknown>) => {
        return await callback()
      }),
      vocabularyEntries: {
        get: vi.fn(async (key: string) => vocabularyEntries.get(key)),
        put: vi.fn(async (entry: VocabularyEntry) => {
          vocabularyEntries.set(entry.key, { ...entry } as VocabularyEntry)
          return entry.key
        }),
        delete: vi.fn(async (key: string) => {
          vocabularyEntries.delete(key)
        }),
        toArray: vi.fn(async () => [...vocabularyEntries.values()].map(entry => ({ ...entry } as VocabularyEntry))),
      },
    },
    storageLocal: {
      get: vi.fn(async (key: string) => ({ [key]: legacyStorage.get(key) })),
      remove: vi.fn(async (key: string) => {
        legacyStorage.delete(key)
      }),
    },
  }
})

vi.mock("#imports", () => ({
  browser: {
    storage: {
      local: mocks.storageLocal,
    },
  },
}))

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: mocks.storageLocal,
    },
  },
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: mocks.db,
}))

vi.mock("dexie", () => ({
  liveQuery: (callback: () => Promise<VocabularyEntry[]>) => ({
    subscribe: ({ next }: { next: (entries: VocabularyEntry[]) => void }) => {
      void callback().then(next)
      return { unsubscribe: vi.fn() }
    },
  }),
}))

function createDictionaryAction({
  id = "default-dictionary",
  fieldPrefix = "default-dictionary",
}: {
  id?: string
  fieldPrefix?: string
} = {}): SelectionToolbarCustomAction {
  return {
    id,
    name: "Dictionary",
    icon: "tabler:book-2",
    providerId: "provider-1",
    systemPrompt: "",
    prompt: "",
    outputSchema: [
      { id: `${fieldPrefix}-term`, name: "Term", type: "string", description: "", speaking: true },
      { id: `${fieldPrefix}-phonetic`, name: "Phonetic", type: "string", description: "", speaking: false },
      { id: `${fieldPrefix}-part-of-speech`, name: "Part of Speech", type: "string", description: "", speaking: false },
      { id: `${fieldPrefix}-definition`, name: "Definition", type: "string", description: "", speaking: false },
      { id: `${fieldPrefix}-context`, name: "Paragraphs", type: "string", description: "", speaking: true },
      { id: `${fieldPrefix}-context-translation`, name: "Paragraphs Translation", type: "string", description: "", speaking: false },
      { id: `${fieldPrefix}-difficulty`, name: "Difficulty", type: "string", description: "", speaking: false },
    ],
  }
}

function createNonDictionaryAction(): SelectionToolbarCustomAction {
  return {
    id: "summary",
    name: "Summary",
    icon: "tabler:sparkles",
    providerId: "provider-1",
    systemPrompt: "",
    prompt: "",
    outputSchema: [
      { id: "summary-field", name: "Summary", type: "string", description: "", speaking: false },
    ],
  }
}

const dictionaryResult = {
  "Term": " Blossom ",
  "Phonetic": "/blossom/",
  "Part of Speech": "noun",
  "Definition": "A flower.",
  "Paragraphs": "Cherry blossoms bloom.",
  "Paragraphs Translation": "樱花盛开。",
  "Difficulty": "B2",
}

function createCandidate(overrides: Partial<VocabularyEntryCandidate> = {}) {
  const candidate = buildVocabularyEntryCandidate({
    action: createDictionaryAction(),
    result: dictionaryResult,
    selectionText: "blossoms",
    sourceCode: "eng",
    sourceTitle: "Article",
    sourceUrl: "https://example.com",
    targetCode: "cmn",
  })

  if (!candidate) {
    throw new Error("Expected candidate")
  }

  return {
    ...candidate,
    ...overrides,
  }
}

function createEntry(overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  const now = new Date("2026-05-15T12:00:00.000Z")
  return {
    ...createCandidate(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as VocabularyEntry
}

async function importVocabularyNotebookStorageApi() {
  return await import("../vocabulary-notebook")
}

describe("vocabulary notebook helpers", () => {
  beforeEach(() => {
    mocks.legacyStorage.clear()
    mocks.vocabularyEntries.clear()
    vi.resetModules()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("normalizes terms by trimming, collapsing whitespace, and lowercasing", () => {
    expect(normalizeVocabularyTerm("  New   WORD  ")).toBe("new word")
    expect(normalizeVocabularyTerm(" \n\t ")).toBe("")
  })

  it("builds stable keys from normalized term and language codes", () => {
    expect(buildVocabularyEntryKey({
      normalizedTerm: "blossom",
      sourceCode: "eng",
      targetCode: "cmn",
    })).toBe("blossom|eng|cmn")
  })

  it("extracts dictionary fields from the default dictionary action", () => {
    const fields = extractDictionaryVocabularyFields(createDictionaryAction(), dictionaryResult)

    expect(fields).toEqual({
      term: "Blossom",
      phonetic: "/blossom/",
      partOfSpeech: "noun",
      definition: "A flower.",
      context: "Cherry blossoms bloom.",
      contextTranslation: "樱花盛开。",
      difficulty: "B2",
    })
  })

  it("supports dictionary actions created from the dictionary template", () => {
    const action = createDictionaryAction({
      id: "custom-dictionary",
      fieldPrefix: "dictionary",
    })
    const candidate = buildVocabularyEntryCandidate({
      action,
      result: dictionaryResult,
      selectionText: "blossoms",
      sourceCode: "eng",
      sourceTitle: "Article",
      sourceUrl: "https://example.com",
      targetCode: "cmn",
    })

    expect(isDictionaryCustomAction(action)).toBe(true)
    expect(candidate).toMatchObject({
      key: "blossom|eng|cmn",
      term: "Blossom",
      normalizedTerm: "blossom",
      selectionText: "blossoms",
      sourceTitle: "Article",
      sourceUrl: "https://example.com",
    })
  })

  it("does not treat non-dictionary custom actions as vocabulary sources", () => {
    const action = createNonDictionaryAction()

    expect(isDictionaryCustomAction(action)).toBe(false)
    expect(extractDictionaryVocabularyFields(action, { Summary: "Text" })).toBeNull()
    expect(buildVocabularyEntryCandidate({
      action,
      result: { Summary: "Text" },
      selectionText: "Text",
      sourceCode: "eng",
      sourceTitle: "Article",
      sourceUrl: "https://example.com",
      targetCode: "cmn",
    })).toBeNull()
  })

  it("migrates legacy storage entries into Dexie and removes the legacy key", async () => {
    const legacyEntry = {
      ...createCandidate(),
      createdAt: "2026-05-15T09:00:00.000Z",
      updatedAt: "2026-05-15T10:00:00.000Z",
    }
    mocks.legacyStorage.set("vocabularyEntries", {
      [legacyEntry.key]: legacyEntry,
    })
    const { findVocabularyEntry } = await importVocabularyNotebookStorageApi()

    const migrated = await findVocabularyEntry(legacyEntry.key)

    expect(mocks.storageLocal.get).toHaveBeenCalledWith("vocabularyEntries")
    expect(mocks.db.vocabularyEntries.put).toHaveBeenCalledWith(expect.objectContaining({ key: legacyEntry.key }))
    expect(migrated).toMatchObject({
      key: legacyEntry.key,
      term: "Blossom",
      createdAt: new Date("2026-05-15T09:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    })

    expect(mocks.storageLocal.remove).toHaveBeenCalledWith("vocabularyEntries")
    expect(mocks.legacyStorage.has("vocabularyEntries")).toBe(false)
  })

  it("upserts entries by key while preserving createdAt", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-15T11:00:00.000Z"))
    const candidate = createCandidate()
    const { upsertVocabularyEntry } = await importVocabularyNotebookStorageApi()
    const created = await upsertVocabularyEntry(candidate)

    vi.setSystemTime(new Date("2026-05-15T12:30:00.000Z"))
    const updated = await upsertVocabularyEntry({
      ...candidate,
      definition: "Updated definition.",
      context: "Updated context.",
    })

    expect(updated).toMatchObject({
      key: candidate.key,
      definition: "Updated definition.",
      context: "Updated context.",
      createdAt: created.createdAt,
      updatedAt: new Date("2026-05-15T12:30:00.000Z"),
    })
    expect(mocks.vocabularyEntries.size).toBe(1)
  })

  it("lists entries by updatedAt descending", async () => {
    const { listVocabularyEntries } = await importVocabularyNotebookStorageApi()
    await mocks.db.vocabularyEntries.put(createEntry({
      key: "older|eng|cmn",
      normalizedTerm: "older",
      term: "older",
      updatedAt: new Date("2026-05-15T09:00:00.000Z"),
    }))
    await mocks.db.vocabularyEntries.put(createEntry({
      key: "newer|eng|cmn",
      normalizedTerm: "newer",
      term: "newer",
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    }))

    await expect(listVocabularyEntries()).resolves.toMatchObject([
      { key: "newer|eng|cmn" },
      { key: "older|eng|cmn" },
    ])
  })

  it("removes entries from Dexie", async () => {
    const { findVocabularyEntry, removeVocabularyEntry } = await importVocabularyNotebookStorageApi()
    const entry = createEntry()
    await mocks.db.vocabularyEntries.put(entry)

    await removeVocabularyEntry(entry.key)

    await expect(findVocabularyEntry(entry.key)).resolves.toBeUndefined()
  })
})
