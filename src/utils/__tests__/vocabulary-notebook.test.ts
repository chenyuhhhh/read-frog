import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import {
  buildVocabularyEntryCandidate,
  buildVocabularyEntryKey,
  extractDictionaryVocabularyFields,
  isDictionaryCustomAction,
  normalizeVocabularyTerm,
} from "../vocabulary-notebook"

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

describe("vocabulary notebook helpers", () => {
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
})
