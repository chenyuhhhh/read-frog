import { beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn()
const vocabularyMocks = vi.hoisted(() => ({
  findVocabularyEntry: vi.fn(),
  removeVocabularyEntry: vi.fn(),
  upsertVocabularyEntry: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("@/utils/vocabulary-notebook", () => ({
  findVocabularyEntry: vocabularyMocks.findVocabularyEntry,
  removeVocabularyEntry: vocabularyMocks.removeVocabularyEntry,
  upsertVocabularyEntry: vocabularyMocks.upsertVocabularyEntry,
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }

  return registration[1] as (message: { data: Record<string, unknown> }) => Promise<unknown>
}

describe("setupVocabularyNotebookMessageHandlers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("checks whether a vocabulary entry exists", async () => {
    vocabularyMocks.findVocabularyEntry.mockResolvedValue({ key: "hello|eng|cmn" })

    const { setupVocabularyNotebookMessageHandlers } = await import("../vocabulary-notebook")
    setupVocabularyNotebookMessageHandlers()

    await expect(getRegisteredMessageHandler("vocabularyEntryExists")({
      data: { key: "hello|eng|cmn" },
    })).resolves.toBe(true)
    expect(vocabularyMocks.findVocabularyEntry).toHaveBeenCalledWith("hello|eng|cmn")
  })

  it("saves and deletes vocabulary entries in the background database", async () => {
    const candidate = { key: "hello|eng|cmn", term: "hello" }
    vocabularyMocks.upsertVocabularyEntry.mockResolvedValue({ key: candidate.key })
    vocabularyMocks.removeVocabularyEntry.mockResolvedValue(undefined)

    const { setupVocabularyNotebookMessageHandlers } = await import("../vocabulary-notebook")
    setupVocabularyNotebookMessageHandlers()

    await expect(getRegisteredMessageHandler("saveVocabularyEntry")({
      data: { candidate },
    })).resolves.toEqual({ key: candidate.key })
    expect(vocabularyMocks.upsertVocabularyEntry).toHaveBeenCalledWith(candidate)

    await expect(getRegisteredMessageHandler("deleteVocabularyEntry")({
      data: { key: candidate.key },
    })).resolves.toEqual({ ok: true })
    expect(vocabularyMocks.removeVocabularyEntry).toHaveBeenCalledWith(candidate.key)
  })
})
