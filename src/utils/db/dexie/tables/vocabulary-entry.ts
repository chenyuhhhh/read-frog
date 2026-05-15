import { Entity } from "dexie"

export default class VocabularyEntry extends Entity {
  key!: string
  term!: string
  normalizedTerm!: string
  phonetic!: string
  partOfSpeech!: string
  definition!: string
  context!: string
  contextTranslation!: string
  difficulty!: string
  selectionText!: string
  sourceUrl!: string
  sourceTitle!: string
  sourceCode!: string
  targetCode!: string
  createdAt!: Date
  updatedAt!: Date
}
