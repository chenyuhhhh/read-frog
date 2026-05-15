import { describe, expect, it } from "vitest"
import { nodeTranslationHotkeySchema, preloadConfigSchema } from "../translate"

describe("preload config validation", () => {
  it("allows a preload margin up to 10000 pixels", () => {
    const result = preloadConfigSchema.safeParse({
      margin: 10000,
      threshold: 0,
    })

    expect(result.success).toBe(true)
  })

  it("rejects a preload margin above 10000 pixels", () => {
    const result = preloadConfigSchema.safeParse({
      margin: 10001,
      threshold: 0,
    })

    expect(result.success).toBe(false)
  })
})

describe("node translation hotkey validation", () => {
  it.each(["control", "clickAndHold", "mouseButton4", "A", "F8", "Space"])("allows %s", (hotkey) => {
    expect(nodeTranslationHotkeySchema.safeParse(hotkey).success).toBe(true)
  })

  it.each(["", "Alt+E", "Escape", "mouseButton1"])("rejects %s", (hotkey) => {
    expect(nodeTranslationHotkeySchema.safeParse(hotkey).success).toBe(false)
  })
})
