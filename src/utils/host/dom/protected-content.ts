import { MATH_TAGS } from "@/utils/constants/dom-rules"

export interface ProtectedContentEntry {
  token: string
  node: Element
}

export interface ProtectedContentState {
  entries: ProtectedContentEntry[]
}

const PROTECTED_CONTENT_TOKEN_PREFIX = "__READ_FROG_PROTECTED_"
const PROTECTED_CONTENT_TOKEN_SUFFIX = "__"
export const PROTECTED_CONTENT_TOKEN_RE = /__READ_FROG_PROTECTED_\d+__/g

const PROTECTED_CONTENT_TAGS = new Set([
  ...[...MATH_TAGS].map(tag => tag.toLowerCase()),
  "mjx-container",
])

const PROTECTED_CONTENT_CLASSES = new Set([
  "katex",
  "ltx_math",
  "math",
  "mathjax",
  "mjx-container",
])

export function createProtectedContentState(): ProtectedContentState {
  return { entries: [] }
}

export function createProtectedContentToken(index: number): string {
  return `${PROTECTED_CONTENT_TOKEN_PREFIX}${index}${PROTECTED_CONTENT_TOKEN_SUFFIX}`
}

export function isProtectedTranslationElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()
  if (PROTECTED_CONTENT_TAGS.has(tagName)) {
    return true
  }

  return [...element.classList].some(className =>
    PROTECTED_CONTENT_CLASSES.has(className.toLowerCase()),
  )
}

export function collectProtectedContent(element: Element, state: ProtectedContentState): string {
  const token = createProtectedContentToken(state.entries.length)
  state.entries.push({ token, node: element })
  return token
}

function getNodeOwnerDocument(node: Node): Document {
  if (node.ownerDocument) {
    return node.ownerDocument
  }
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return node as Document
  }
  return document
}

function cloneNodeWithProtectedContent(node: Node, state: ProtectedContentState): Node | null {
  const ownerDoc = getNodeOwnerDocument(node)

  if (node.nodeType === Node.TEXT_NODE) {
    return ownerDoc.createTextNode(node.textContent ?? "")
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as Element
  if (isProtectedTranslationElement(element)) {
    return ownerDoc.createTextNode(collectProtectedContent(element, state))
  }

  const clone = element.cloneNode(false) as Element
  for (const child of element.childNodes) {
    const clonedChild = cloneNodeWithProtectedContent(child, state)
    if (clonedChild) {
      clone.appendChild(clonedChild)
    }
  }
  return clone
}

export function serializeNodeWithProtectedContent(node: Element | Text, state: ProtectedContentState): string {
  const clonedNode = cloneNodeWithProtectedContent(node, state)
  if (!clonedNode) {
    return ""
  }

  if (clonedNode.nodeType === Node.TEXT_NODE) {
    return clonedNode.textContent ?? ""
  }

  return (clonedNode as Element).outerHTML
}

export function removeProtectedContentTokens(text: string): string {
  return text.replace(PROTECTED_CONTENT_TOKEN_RE, "")
}

function appendTextAndProtectedContent(
  fragment: DocumentFragment,
  text: string,
  entriesByToken: Map<string, ProtectedContentEntry>,
): boolean {
  const ownerDoc = fragment.ownerDocument
  const tokenRegex = new RegExp(PROTECTED_CONTENT_TOKEN_RE.source, "g")
  let lastIndex = 0
  let replaced = false

  for (const match of text.matchAll(tokenRegex)) {
    const token = match[0]
    const entry = entriesByToken.get(token)
    if (!entry || match.index === undefined) {
      continue
    }

    if (match.index > lastIndex) {
      fragment.appendChild(ownerDoc.createTextNode(text.slice(lastIndex, match.index)))
    }
    fragment.appendChild(entry.node.cloneNode(true))
    lastIndex = match.index + token.length
    replaced = true
  }

  if (lastIndex < text.length) {
    fragment.appendChild(ownerDoc.createTextNode(text.slice(lastIndex)))
  }

  return replaced
}

export function replaceProtectedContentTokens(root: Node, entries: ProtectedContentEntry[]): void {
  if (entries.length === 0) {
    return
  }

  const ownerDoc = root.ownerDocument ?? document
  const entriesByToken = new Map(entries.map(entry => [entry.token, entry]))
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ""
    if (!PROTECTED_CONTENT_TOKEN_RE.test(text)) {
      PROTECTED_CONTENT_TOKEN_RE.lastIndex = 0
      continue
    }
    PROTECTED_CONTENT_TOKEN_RE.lastIndex = 0

    const fragment = ownerDoc.createDocumentFragment()
    const replaced = appendTextAndProtectedContent(fragment, text, entriesByToken)
    if (replaced) {
      textNode.parentNode?.replaceChild(fragment, textNode)
    }
  }
}
