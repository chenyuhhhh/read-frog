import { onMessage } from "@/utils/message"
import {
  findVocabularyEntry,
  removeVocabularyEntry,
  upsertVocabularyEntry,
} from "@/utils/vocabulary-notebook"

export function setupVocabularyNotebookMessageHandlers() {
  onMessage("vocabularyEntryExists", async (message) => {
    return !!(await findVocabularyEntry(message.data.key))
  })

  onMessage("saveVocabularyEntry", async (message) => {
    const entry = await upsertVocabularyEntry(message.data.candidate)
    return { key: entry.key }
  })

  onMessage("deleteVocabularyEntry", async (message) => {
    await removeVocabularyEntry(message.data.key)
    return { ok: true as const }
  })
}
