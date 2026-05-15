// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockCreateMarkdownContent, mockDefuddleConstructor, mockParse, mockWarn } = vi.hoisted(() => ({
  mockCreateMarkdownContent: vi.fn(),
  mockDefuddleConstructor: vi.fn(),
  mockParse: vi.fn(),
  mockWarn: vi.fn(),
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}))

async function loadModule() {
  vi.resetModules()
  vi.doMock("defuddle/full", () => ({
    __esModule: true,
    createMarkdownContent: mockCreateMarkdownContent,
    default: class MockDefuddle {
      constructor(...args: unknown[]) {
        mockDefuddleConstructor(...args)
      }

      parse() {
        return mockParse()
      }
    },
  }))
  return await import("../webpage-context")
}

describe("getOrCreateWebPageContext", () => {
  beforeEach(() => {
    mockDefuddleConstructor.mockReset()
    mockCreateMarkdownContent.mockReset()
    mockParse.mockReset()
    mockWarn.mockReset()

    mockParse.mockReturnValue({
      content: "<h1>Readable page body</h1>",
      contentMarkdown: "# Readable page body",
    })
    mockCreateMarkdownContent.mockReturnValue("# Converted readable page body")

    document.title = "Original Title"
    document.body.innerHTML = "<main>Page body</main>"
    window.history.replaceState({}, "", "/article")
  })

  it("keeps the original title stable on the same URL", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Translated Browser Title"
    const second = await getOrCreateWebPageContext()

    expect(first?.webTitle).toBe("Original Title")
    expect(first?.webContent).toBe("# Readable page body")
    expect(second).toEqual({
      url: first?.url,
      webTitle: "Original Title",
      webContent: first?.webContent,
    })
    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(1)
  })

  it("parses webpage content as markdown with Defuddle", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("# Readable page body")
    expect(mockDefuddleConstructor).toHaveBeenCalledWith(expect.any(Document), {
      separateMarkdown: true,
      url: window.location.href,
      useAsync: false,
    })
    expect(mockDefuddleConstructor.mock.calls[0]?.[0]).not.toBe(document)
  })

  it("normalizes relative metadata URLs before Defuddle parsing", async () => {
    document.head.innerHTML = `
      <base href="/tutorials/">
      <link rel="canonical" href="./beginner/basics/intro.html">
      <meta property="og:url" content="/tutorials/beginner/basics/intro.html#">
      <meta name="twitter:url" content="beginner/basics/data_tutorial.html">
    `
    window.history.replaceState({}, "", "/tutorials/beginner/basics/intro.html#")
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()

    const snapshotDoc = mockDefuddleConstructor.mock.calls[0]?.[0] as Document
    const metadataBaseUrl = new URL("/tutorials/", window.location.href).href
    expect(snapshotDoc.querySelector("base")?.getAttribute("href")).toBe(
      metadataBaseUrl,
    )
    expect(snapshotDoc.querySelector("link[rel~=\"canonical\"]")?.getAttribute("href")).toBe(
      new URL("./beginner/basics/intro.html", metadataBaseUrl).href,
    )
    expect(snapshotDoc.querySelector("meta[property=\"og:url\"]")?.getAttribute("content")).toBe(
      new URL("/tutorials/beginner/basics/intro.html#", metadataBaseUrl).href,
    )
    expect(snapshotDoc.querySelector("meta[name=\"twitter:url\"]")?.getAttribute("content")).toBe(
      new URL("beginner/basics/data_tutorial.html", metadataBaseUrl).href,
    )
  })

  it("adds an absolute page URL when metadata has no usable URL", async () => {
    document.head.innerHTML = "<script type=\"application/ld+json\">{\"url\":\"/relative-schema-url\"}</script>"
    window.history.replaceState({}, "", "/tutorials/beginner/basics/intro.html#")
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()

    const snapshotDoc = mockDefuddleConstructor.mock.calls[0]?.[0] as Document
    expect(snapshotDoc.querySelector("meta[property=\"og:url\"]")?.getAttribute("content")).toBe(window.location.href)
  })

  it("converts Defuddle HTML content when a separate markdown field is missing", async () => {
    mockParse.mockReturnValueOnce({ content: "<h1>Readable page body</h1>" })
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("# Converted readable page body")
    expect(mockCreateMarkdownContent).toHaveBeenCalledWith(
      "<h1>Readable page body</h1>",
      window.location.href,
    )
  })

  it("refreshes the cached title and content after the URL changes", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Next Article Title"
    document.body.innerHTML = "<main>Next article body</main>"
    mockParse.mockReturnValueOnce({ contentMarkdown: "## Next readable page body" })
    window.history.replaceState({}, "", "/article-2")

    const second = await getOrCreateWebPageContext()

    expect(first?.webTitle).toBe("Original Title")
    expect(second?.webTitle).toBe("Next Article Title")
    expect(second?.webContent).toBeTruthy()
    expect(second?.webContent).not.toBe(first?.webContent)
  })

  it("truncates webpage content to the shared limit when caching a new URL", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const longContent = "x".repeat(2100)
    document.body.innerHTML = `<main>${longContent}</main>`
    mockParse.mockReturnValueOnce({ contentMarkdown: longContent })

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toHaveLength(2000)
    expect(result?.webContent).toBe(longContent.slice(0, 2000))
  })

  it("falls back to body text when Defuddle parsing fails", async () => {
    mockParse.mockImplementationOnce(() => {
      throw new Error("parse failed")
    })
    document.body.innerHTML = "<main>Fallback body text</main>"
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("Fallback body text")
    expect(mockWarn).toHaveBeenCalledWith(
      "Defuddle parsing failed, falling back to body text:",
      expect.any(Error),
    )
  })
})
