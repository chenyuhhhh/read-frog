import { describe, expect, it } from "vitest"
import { isWebExtensionRuntimeAvailable } from "../web-extension-environment"

describe("isWebExtensionRuntimeAvailable", () => {
  it("returns true when chrome.runtime.id is available", () => {
    expect(isWebExtensionRuntimeAvailable({
      chrome: {
        runtime: {
          id: "extension-id",
        },
      },
    })).toBe(true)
  })

  it("returns true when browser.runtime.id is available", () => {
    expect(isWebExtensionRuntimeAvailable({
      browser: {
        runtime: {
          id: "extension-id",
        },
      },
    })).toBe(true)
  })

  it("returns false for regular page chrome objects without runtime.id", () => {
    expect(isWebExtensionRuntimeAvailable({
      chrome: {
        app: {},
      },
    })).toBe(false)
  })

  it("returns false when extension globals are missing", () => {
    expect(isWebExtensionRuntimeAvailable({})).toBe(false)
  })
})
