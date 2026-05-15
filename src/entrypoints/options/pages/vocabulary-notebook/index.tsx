import type { KeyboardEvent, ReactNode } from "react"
import type VocabularyEntry from "@/utils/db/dexie/tables/vocabulary-entry"
import { i18n } from "#imports"
import { IconBook2, IconSearch, IconTrash } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import { Input } from "@/components/ui/base-ui/input"
import { ScrollArea } from "@/components/ui/base-ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/base-ui/table"
import {
  listVocabularyEntries,
  observeVocabularyEntries,
  removeVocabularyEntry,
  VOCABULARY_ENTRIES_QUERY_KEY,
} from "@/utils/vocabulary-notebook"
import { PageLayout } from "../../components/page-layout"

function includesQuery(entry: VocabularyEntry, query: string): boolean {
  if (!query) {
    return true
  }

  return [
    entry.term,
    entry.phonetic,
    entry.partOfSpeech,
    entry.definition,
    entry.context,
    entry.contextTranslation,
    entry.difficulty,
    entry.selectionText,
    entry.sourceTitle,
    entry.sourceUrl,
  ].some(value => value.toLocaleLowerCase().includes(query))
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function handleOpenEntryRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  openEntry: () => void,
) {
  if (event.target !== event.currentTarget)
    return
  if (event.key !== "Enter" && event.key !== " ")
    return

  event.preventDefault()
  openEntry()
}

function DetailSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  if (!children) {
    return null
  }

  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium uppercase text-muted-foreground">{label}</h3>
      <div className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  )
}

function VocabularyEntryDetailsDialog({
  entry,
  onOpenChange,
}: {
  entry: VocabularyEntry | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      {entry && (
        <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-4 pr-12">
            <DialogTitle className="break-words text-xl leading-7 [overflow-wrap:anywhere]">
              {entry.term}
            </DialogTitle>
            <DialogDescription>
              {entry.phonetic && <span>{entry.phonetic}</span>}
              {entry.phonetic && entry.partOfSpeech && <span> · </span>}
              {entry.partOfSpeech && <span>{entry.partOfSpeech}</span>}
              {(entry.phonetic || entry.partOfSpeech) && entry.difficulty && <span> · </span>}
              {entry.difficulty && <span>{entry.difficulty}</span>}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(100vh-10rem)]">
            <div className="space-y-5 p-4">
              <DetailSection label={i18n.t("vocabularyNotebook.definition")}>
                {entry.definition || "—"}
              </DetailSection>

              <DetailSection label={i18n.t("vocabularyNotebook.context")}>
                {entry.context || entry.selectionText || "—"}
              </DetailSection>

              {entry.contextTranslation && (
                <DetailSection label={i18n.t("vocabularyNotebook.contextTranslation")}>
                  {entry.contextTranslation}
                </DetailSection>
              )}

              {entry.selectionText && (
                <DetailSection label={i18n.t("vocabularyNotebook.selectionText")}>
                  {entry.selectionText}
                </DetailSection>
              )}

              <div className="grid gap-3 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">{i18n.t("vocabularyNotebook.source")}</div>
                  <div className="mt-1 break-words [overflow-wrap:anywhere]">
                    {entry.sourceTitle || entry.sourceUrl || "—"}
                  </div>
                  {entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-words text-primary hover:underline [overflow-wrap:anywhere]"
                    >
                      {entry.sourceUrl}
                    </a>
                  )}
                </div>
                <div>
                  <div className="font-medium text-foreground">{i18n.t("vocabularyNotebook.createdAt")}</div>
                  <div className="mt-1">{formatDate(entry.createdAt)}</div>
                  <div className="mt-3 font-medium text-foreground">{i18n.t("vocabularyNotebook.updatedAt")}</div>
                  <div className="mt-1">{formatDate(entry.updatedAt)}</div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      )}
    </Dialog>
  )
}

export function VocabularyNotebookPage() {
  const [search, setSearch] = useState("")
  const [selectedEntry, setSelectedEntry] = useState<VocabularyEntry | null>(null)
  const queryClient = useQueryClient()
  const entriesQuery = useQuery({
    queryKey: VOCABULARY_ENTRIES_QUERY_KEY,
    queryFn: listVocabularyEntries,
    retry: false,
  })

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let disposed = false
    const refetchEntries = () => {
      void queryClient.invalidateQueries({ queryKey: VOCABULARY_ENTRIES_QUERY_KEY })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchEntries()
      }
    }

    void observeVocabularyEntries((entries) => {
      queryClient.setQueryData(VOCABULARY_ENTRIES_QUERY_KEY, entries)
    })
      .then((subscription) => {
        if (disposed) {
          subscription.unsubscribe()
          return
        }
        unsubscribe = () => subscription.unsubscribe()
      })
      .catch(() => undefined)

    window.addEventListener("focus", refetchEntries)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      disposed = true
      unsubscribe?.()
      window.removeEventListener("focus", refetchEntries)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: removeVocabularyEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: VOCABULARY_ENTRIES_QUERY_KEY })
      toast.success(i18n.t("vocabularyNotebook.deleted"))
    },
  })
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const filteredEntries = useMemo(
    () => entries.filter(entry => includesQuery(entry, normalizedSearch)),
    [entries, normalizedSearch],
  )
  const isEmpty = !entriesQuery.isLoading && entries.length === 0
  const isNoSearchResult = !entriesQuery.isLoading && entries.length > 0 && filteredEntries.length === 0

  return (
    <PageLayout
      title={i18n.t("vocabularyNotebook.title")}
      innerClassName="p-8 space-y-6"
    >
      <VocabularyEntryDetailsDialog
        entry={selectedEntry}
        onOpenChange={(open) => {
          if (!open)
            setSelectedEntry(null)
        }}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          {i18n.t("vocabularyNotebook.description")}
        </div>
        <div className="relative w-full md:w-80">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={i18n.t("vocabularyNotebook.searchPlaceholder")}
            className="pl-8"
          />
        </div>
      </div>

      {entriesQuery.isLoading && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {i18n.t("vocabularyNotebook.loading")}
        </div>
      )}

      {(isEmpty || isNoSearchResult) && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <IconBook2 className="mx-auto mb-3 size-8 text-muted-foreground" />
          <div className="text-sm font-medium">
            {i18n.t(isEmpty ? "vocabularyNotebook.emptyTitle" : "vocabularyNotebook.noSearchResults")}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {i18n.t(isEmpty ? "vocabularyNotebook.emptyDescription" : "vocabularyNotebook.noSearchResultsDescription")}
          </div>
        </div>
      )}

      {!entriesQuery.isLoading && filteredEntries.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">{i18n.t("vocabularyNotebook.term")}</TableHead>
                <TableHead>{i18n.t("vocabularyNotebook.definition")}</TableHead>
                <TableHead className="w-64">{i18n.t("vocabularyNotebook.context")}</TableHead>
                <TableHead className="w-40">{i18n.t("vocabularyNotebook.updatedAt")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{i18n.t("vocabularyNotebook.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const openEntry = () => setSelectedEntry(entry)
                return (
                  <TableRow
                    key={entry.key}
                    role="button"
                    tabIndex={0}
                    aria-label={i18n.t("vocabularyNotebook.viewDetails", [entry.term])}
                    className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={openEntry}
                    onKeyDown={event => handleOpenEntryRowKeyDown(event, openEntry)}
                  >
                    <TableCell className="align-top whitespace-normal">
                      <div className="font-medium break-words text-primary underline-offset-4 [overflow-wrap:anywhere] group-hover:underline">
                        {entry.term}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.phonetic && <Badge variant="secondary">{entry.phonetic}</Badge>}
                        {entry.partOfSpeech && <Badge variant="outline">{entry.partOfSpeech}</Badge>}
                        {entry.difficulty && <Badge variant="outline">{entry.difficulty}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md align-top whitespace-normal">
                      <div className="line-clamp-4 break-words [overflow-wrap:anywhere]">{entry.definition || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-sm align-top whitespace-normal">
                      <div className="line-clamp-4 break-words text-muted-foreground [overflow-wrap:anywhere]">
                        {entry.context || entry.selectionText || "—"}
                      </div>
                      {entry.contextTranslation && (
                        <div className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {entry.contextTranslation}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {formatDate(entry.updatedAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost-secondary"
                        size="icon-sm"
                        aria-label={i18n.t("vocabularyNotebook.delete")}
                        title={i18n.t("vocabularyNotebook.delete")}
                        disabled={deleteMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteMutation.mutate(entry.key)
                        }}
                      >
                        <IconTrash />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PageLayout>
  )
}
