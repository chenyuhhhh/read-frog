import type { VocabularyEntryCandidate } from "@/utils/vocabulary-notebook"
import { sendMessage } from "@/utils/message"

export type VocabularyNotebookRuntimeRequestInput
  = | { action: "exists", key: string }
    | { action: "save", candidate: VocabularyEntryCandidate }
    | { action: "delete", key: string }

export type VocabularyNotebookRuntimeResponse
  = | { ok: true, exists: boolean }
    | { ok: true, key: string }
    | { ok: true }
    | { ok: false, message: string }

export async function sendVocabularyNotebookRuntimeMessage(
  input: VocabularyNotebookRuntimeRequestInput,
): Promise<VocabularyNotebookRuntimeResponse> {
  if (input.action === "exists") {
    return {
      ok: true,
      exists: await sendMessage("vocabularyEntryExists", { key: input.key }),
    }
  }

  if (input.action === "save") {
    const response = await sendMessage("saveVocabularyEntry", { candidate: input.candidate })
    return {
      ok: true,
      key: response.key,
    }
  }

  await sendMessage("deleteVocabularyEntry", { key: input.key })
  return { ok: true }
}
