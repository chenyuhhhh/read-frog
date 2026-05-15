// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { i18n } from "#imports"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { VocabularyStarButton } from "../vocabulary-star-button"

const vocabularyMocks = vi.hoisted(() => ({
  sendVocabularyNotebookRuntimeMessage: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/utils/vocabulary-notebook-runtime-message", () => ({
  sendVocabularyNotebookRuntimeMessage: vocabularyMocks.sendVocabularyNotebookRuntimeMessage,
}))

vi.mock("sonner", () => ({
  toast: {
    error: vocabularyMocks.toastError,
    success: vocabularyMocks.toastSuccess,
  },
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createDictionaryAction(): SelectionToolbarCustomAction {
  return {
    id: "default-dictionary",
    name: "Dictionary",
    icon: "tabler:book-2",
    providerId: "provider-1",
    systemPrompt: "",
    prompt: "",
    outputSchema: [
      { id: "default-dictionary-term", name: "Term", type: "string", description: "", speaking: true },
      { id: "default-dictionary-definition", name: "Definition", type: "string", description: "", speaking: false },
      { id: "default-dictionary-context", name: "Paragraphs", type: "string", description: "", speaking: true },
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

function createEntry(): VocabularyEntry {
  return {
    key: "blossom|eng|cmn",
    term: "blossom",
    normalizedTerm: "blossom",
    phonetic: "",
    partOfSpeech: "",
    definition: "A flower.",
    context: "Cherry blossoms bloom.",
    contextTranslation: "",
    difficulty: "",
    selectionText: "blossoms",
    sourceUrl: "https://example.com",
    sourceTitle: "Example",
    sourceCode: "eng",
    targetCode: "cmn",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  } as VocabularyEntry
}

function renderStarButton({
  action = createDictionaryAction(),
  isRunning = false,
  result = {
    Term: "blossom",
    Definition: "A flower.",
    Paragraphs: "Cherry blossoms bloom.",
  },
}: {
  action?: SelectionToolbarCustomAction
  isRunning?: boolean
  result?: Record<string, unknown> | null
} = {}) {
  const store = createStore()
  const config = cloneConfig(DEFAULT_CONFIG)
  config.language.sourceCode = "eng"
  config.language.targetCode = "cmn"
  store.set(configAtom, config)

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Provider store={store}>
        <VocabularyStarButton
          action={action}
          isRunning={isRunning}
          result={result}
          selectionText="blossoms"
          sourceTitle="Example"
        />
      </Provider>
    </QueryClientProvider>,
  )
}

describe("vocabulary star button", () => {
  beforeEach(() => {
    vocabularyMocks.sendVocabularyNotebookRuntimeMessage.mockReset()
    vocabularyMocks.toastError.mockReset()
    vocabularyMocks.toastSuccess.mockReset()
  })

  it("does not render for non-dictionary custom actions", () => {
    renderStarButton({ action: createNonDictionaryAction() })

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("disables the star while the dictionary result is running", () => {
    renderStarButton({ isRunning: true, result: null })

    expect(screen.getByRole("button", { name: i18n.t("vocabularyNotebook.unavailable") })).toBeDisabled()
  })

  it("saves a dictionary result and switches to remove state", async () => {
    const entry = createEntry()
    let isSaved = false
    vocabularyMocks.sendVocabularyNotebookRuntimeMessage.mockImplementation(async (message: { action: string }) => {
      if (message.action === "exists") {
        return { ok: true, exists: isSaved }
      }
      if (message.action === "save") {
        isSaved = true
        return { ok: true, key: entry.key }
      }
      return undefined
    })
    renderStarButton()

    const addButton = await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.add") })
    await waitFor(() => expect(addButton).toBeEnabled())
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(vocabularyMocks.sendVocabularyNotebookRuntimeMessage).toHaveBeenCalledWith({
        action: "save",
        candidate: expect.objectContaining({
          term: "blossom",
          normalizedTerm: "blossom",
        }),
      })
    })
    await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.remove") })
    expect(vocabularyMocks.toastSuccess).toHaveBeenCalledWith(i18n.t("vocabularyNotebook.saved"))
  })

  it("removes an existing vocabulary entry", async () => {
    let isSaved = true
    vocabularyMocks.sendVocabularyNotebookRuntimeMessage.mockImplementation(async (message: { action: string }) => {
      if (message.action === "exists") {
        return { ok: true, exists: isSaved }
      }
      if (message.action === "delete") {
        isSaved = false
        return { ok: true }
      }
      return undefined
    })
    renderStarButton()

    const removeButton = await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.remove") })
    await waitFor(() => expect(removeButton).toBeEnabled())
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(vocabularyMocks.sendVocabularyNotebookRuntimeMessage).toHaveBeenCalledWith({
        action: "delete",
        key: "blossom|auto|cmn",
      })
    })
    await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.add") })
  })

  it("shows an error toast when saving fails", async () => {
    vocabularyMocks.sendVocabularyNotebookRuntimeMessage.mockImplementation(async (message: { action: string }) => {
      if (message.action === "exists") {
        return { ok: true, exists: false }
      }
      throw new Error("background unavailable")
    })
    renderStarButton()

    const addButton = await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.add") })
    await waitFor(() => expect(addButton).toBeEnabled())
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(vocabularyMocks.toastError).toHaveBeenCalledWith(
        i18n.t("vocabularyNotebook.updateFailed"),
        { description: "background unavailable" },
      )
    })
  })
})
