// @vitest-environment jsdom
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { i18n } from "#imports"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/base-ui/sidebar"
import { VocabularyNotebookPage } from "../index"

const vocabularyMocks = vi.hoisted(() => ({
  listVocabularyEntries: vi.fn(),
  observeVocabularyEntries: vi.fn(),
  removeVocabularyEntry: vi.fn(),
}))

vi.mock("@/utils/vocabulary-notebook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/vocabulary-notebook")>()
  return {
    ...actual,
    listVocabularyEntries: vocabularyMocks.listVocabularyEntries,
    observeVocabularyEntries: vocabularyMocks.observeVocabularyEntries,
    removeVocabularyEntry: vocabularyMocks.removeVocabularyEntry,
  }
})

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}))

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

function createEntry(overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    key: "blossom|eng|cmn",
    term: "blossom",
    normalizedTerm: "blossom",
    phonetic: "/blossom/",
    partOfSpeech: "noun",
    definition: "A flower.",
    context: "Cherry blossoms bloom.",
    contextTranslation: "樱花盛开。",
    difficulty: "B2",
    selectionText: "blossoms",
    sourceUrl: "https://example.com",
    sourceTitle: "Example",
    sourceCode: "eng",
    targetCode: "cmn",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  } as VocabularyEntry
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SidebarProvider>
        <VocabularyNotebookPage />
      </SidebarProvider>
    </QueryClientProvider>,
  )
}

describe("vocabulary notebook page", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vocabularyMocks.listVocabularyEntries.mockReset()
    vocabularyMocks.observeVocabularyEntries.mockReset()
    vocabularyMocks.removeVocabularyEntry.mockReset()
    vocabularyMocks.observeVocabularyEntries.mockResolvedValue({ unsubscribe: vi.fn() })
  })

  it("renders vocabulary entries and filters by search text", async () => {
    vocabularyMocks.listVocabularyEntries.mockResolvedValue([
      createEntry(),
      createEntry({
        key: "ephemeral|eng|cmn",
        term: "ephemeral",
        normalizedTerm: "ephemeral",
        definition: "Lasting for a short time.",
        context: "The ephemeral beauty fades.",
      }),
    ])

    renderPage()

    expect(await screen.findByText("blossom")).toBeInTheDocument()
    expect(screen.getByText("ephemeral")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(i18n.t("vocabularyNotebook.searchPlaceholder")), {
      target: { value: "short time" },
    })

    expect(screen.queryByText("blossom")).not.toBeInTheDocument()
    expect(screen.getByText("ephemeral")).toBeInTheDocument()
  })

  it("renders the empty state", async () => {
    vocabularyMocks.listVocabularyEntries.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(i18n.t("vocabularyNotebook.emptyTitle"))).toBeInTheDocument()
  })

  it("opens a full vocabulary detail card from any row cell", async () => {
    vocabularyMocks.listVocabularyEntries.mockResolvedValue([
      createEntry({
        context: "Cherry blossoms bloom across the riverbank in spring while visitors stop to read every sign along the path.",
        contextTranslation: "春天樱花在河岸边盛开，游客会停下来阅读路边的每一个标识。",
      }),
    ])

    renderPage()

    fireEvent.click(await screen.findByText(/riverbank/))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(i18n.t("vocabularyNotebook.source"))).toBeInTheDocument()
    expect(screen.getByText("Example")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "https://example.com" })).toHaveAttribute("href", "https://example.com")
    expect(screen.getByText(i18n.t("vocabularyNotebook.contextTranslation"))).toBeInTheDocument()
  })

  it("deletes a vocabulary entry", async () => {
    vocabularyMocks.listVocabularyEntries.mockResolvedValue([createEntry()])
    vocabularyMocks.removeVocabularyEntry.mockResolvedValue(undefined)

    renderPage()

    const deleteButton = await screen.findByRole("button", { name: i18n.t("vocabularyNotebook.delete") })
    fireEvent.click(deleteButton)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(vocabularyMocks.removeVocabularyEntry.mock.calls[0]?.[0]).toBe("blossom|eng|cmn")
    })
  })
})
