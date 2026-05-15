import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { IconStar, IconStarFilled } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  buildVocabularyEntryCandidate,
  getVocabularyEntryQueryKey,
  isDictionaryCustomAction,
  VOCABULARY_ENTRIES_QUERY_KEY,
} from "@/utils/vocabulary-notebook"
import { sendVocabularyNotebookRuntimeMessage } from "@/utils/vocabulary-notebook-runtime-message"

export function VocabularyStarButton({
  action,
  isRunning,
  result,
  selectionText,
  sourceTitle,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
  selectionText: string | null | undefined
  sourceTitle: string | null | undefined
}) {
  if (!isDictionaryCustomAction(action)) {
    return null
  }

  return (
    <VocabularyStarButtonEnabled
      action={action}
      isRunning={isRunning}
      result={result}
      selectionText={selectionText}
      sourceTitle={sourceTitle}
    />
  )
}

function VocabularyStarButtonEnabled({
  action,
  isRunning,
  result,
  selectionText,
  sourceTitle,
}: {
  action: SelectionToolbarCustomAction
  isRunning: boolean
  result: Record<string, unknown> | null
  selectionText: string | null | undefined
  sourceTitle: string | null | undefined
}) {
  const language = useAtomValue(configFieldsAtomMap.language)
  const queryClient = useQueryClient()
  const fallbackSourceTitle = typeof document === "undefined" ? "" : document.title
  const sourceUrl = typeof window === "undefined" ? "" : window.location.href
  const candidate = useMemo(() => buildVocabularyEntryCandidate({
    action,
    result,
    selectionText,
    sourceCode: language.sourceCode,
    sourceTitle: sourceTitle ?? fallbackSourceTitle,
    sourceUrl,
    targetCode: language.targetCode,
  }), [action, fallbackSourceTitle, language.sourceCode, language.targetCode, result, selectionText, sourceTitle, sourceUrl])
  const entryQuery = useQuery({
    queryKey: candidate ? getVocabularyEntryQueryKey(candidate.key) : ["vocabulary-entry", "unavailable"],
    queryFn: async () => {
      if (!candidate) {
        return false
      }

      const response = await sendVocabularyNotebookRuntimeMessage({ action: "exists", key: candidate.key })
      return "exists" in response ? response.exists : false
    },
    enabled: !!candidate,
    retry: false,
    meta: {
      suppressToast: true,
    },
  })
  const isSaved = entryQuery.data === true
  const mutation = useMutation({
    mutationFn: async () => {
      if (!candidate) {
        return null
      }

      if (isSaved) {
        await sendVocabularyNotebookRuntimeMessage({ action: "delete", key: candidate.key })
        return { status: "removed" as const }
      }

      await sendVocabularyNotebookRuntimeMessage({ action: "save", candidate })
      return { status: "saved" as const }
    },
    onSuccess: async (result) => {
      if (!candidate || !result) {
        return
      }

      queryClient.setQueryData(
        getVocabularyEntryQueryKey(candidate.key),
        result.status === "saved",
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getVocabularyEntryQueryKey(candidate.key) }),
        queryClient.invalidateQueries({ queryKey: VOCABULARY_ENTRIES_QUERY_KEY }),
      ])

      toast.success(i18n.t(result.status === "saved"
        ? "vocabularyNotebook.saved"
        : "vocabularyNotebook.removed"))
    },
    onError: (error: unknown) => {
      toast.error(i18n.t("vocabularyNotebook.updateFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    },
    meta: {
      suppressToast: true,
    },
  })

  const isDisabled = isRunning || !candidate || entryQuery.isFetching || mutation.isPending
  const label = candidate
    ? i18n.t(isSaved ? "vocabularyNotebook.remove" : "vocabularyNotebook.add")
    : i18n.t("vocabularyNotebook.unavailable")

  return (
    <Button
      type="button"
      variant="ghost-secondary"
      size="icon-sm"
      className={isSaved ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300" : undefined}
      disabled={isDisabled}
      aria-label={label}
      aria-pressed={isSaved}
      title={label}
      data-rf-no-drag
      onClick={() => mutation.mutate()}
    >
      {isSaved ? <IconStarFilled /> : <IconStar />}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
