import type { WebPageContext } from "@/types/content"
import { getDocumentDescription } from "@/utils/content/metadata"
import { logger } from "@/utils/logger"
import { truncateWebPageContent } from "./webpage-content"

export interface CachedWebPageContext extends WebPageContext {
  url: string
  webContent: string
}

let cachedWebPageContext: CachedWebPageContext | null = null

function toAbsoluteUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value?.trim()) {
    return null
  }

  try {
    return new URL(value.trim(), baseUrl).href
  }
  catch {
    return null
  }
}

function ensureSnapshotHead(doc: Document): HTMLHeadElement {
  if (doc.head) {
    return doc.head
  }

  const head = doc.createElement("head")
  doc.documentElement.insertBefore(head, doc.body ?? null)
  return head
}

function normalizeUrlAttribute(doc: Document, selector: string, attributeName: string, baseUrl: string) {
  doc.querySelectorAll(selector).forEach((element) => {
    const normalized = toAbsoluteUrl(element.getAttribute(attributeName), baseUrl)
    if (normalized) {
      element.setAttribute(attributeName, normalized)
      return
    }

    element.removeAttribute(attributeName)
  })
}

function ensureSnapshotPageUrl(doc: Document, pageUrl: string) {
  const head = ensureSnapshotHead(doc)
  let meta = head.querySelector("meta[property=\"og:url\"]")
  if (!meta) {
    meta = doc.createElement("meta")
    meta.setAttribute("property", "og:url")
    head.prepend(meta)
  }

  meta.setAttribute("content", toAbsoluteUrl(meta.getAttribute("content"), pageUrl) ?? pageUrl)
}

function normalizeSnapshotMetadataUrls(doc: Document, baseUrl: string) {
  const head = ensureSnapshotHead(doc)
  let base = head.querySelector("base[href]")
  if (!base) {
    base = doc.createElement("base")
    head.prepend(base)
  }

  const metadataBaseUrl = toAbsoluteUrl(base.getAttribute("href"), baseUrl) ?? baseUrl
  base.setAttribute("href", metadataBaseUrl)
  normalizeUrlAttribute(doc, "link[rel~=\"canonical\"][href]", "href", metadataBaseUrl)
  normalizeUrlAttribute(doc, "meta[property=\"og:url\"][content]", "content", metadataBaseUrl)
  normalizeUrlAttribute(doc, "meta[name=\"twitter:url\"][content]", "content", metadataBaseUrl)
  ensureSnapshotPageUrl(doc, baseUrl)
}

function createDefuddleSnapshotDocument() {
  const clonedDoc = document.implementation.createHTMLDocument(document.title)
  const clonedDocumentElement = document.documentElement.cloneNode(true)
  clonedDoc.replaceChild(clonedDoc.importNode(clonedDocumentElement, true), clonedDoc.documentElement)
  normalizeSnapshotMetadataUrls(clonedDoc, window.location.href)
  return clonedDoc
}

async function extractWebpageContent(): Promise<string> {
  try {
    const { default: Defuddle, createMarkdownContent } = await import("defuddle/full")
    const snapshotDoc = createDefuddleSnapshotDocument()
    const result = new Defuddle(snapshotDoc, {
      separateMarkdown: true,
      url: window.location.href,
      useAsync: false,
    }).parse()

    if (result.contentMarkdown)
      return result.contentMarkdown
    if (result.content)
      return createMarkdownContent(result.content, window.location.href)
  }
  catch (error) {
    logger.warn("Defuddle parsing failed, falling back to body text:", error)
  }
  return document.body?.textContent || ""
}

export async function getOrCreateWebPageContext(): Promise<CachedWebPageContext | null> {
  if (typeof window === "undefined" || typeof document === "undefined")
    return null

  const currentUrl = window.location.href
  if (cachedWebPageContext?.url === currentUrl) {
    return cachedWebPageContext
  }

  cachedWebPageContext = {
    url: currentUrl,
    webTitle: document.title || "",
    webDescription: getDocumentDescription(document),
    webContent: truncateWebPageContent(await extractWebpageContent()),
  }
  return cachedWebPageContext
}
