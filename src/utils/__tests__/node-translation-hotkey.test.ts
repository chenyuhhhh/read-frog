// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { formatNodeTranslationHotkey, isValidConfiguredNodeTranslationHotkey, keyboardEventToNodeTranslationHotkey, mouseEventToNodeTranslationHotkey, nodeTranslationHotkeyMatchesKeyboardEvent, nodeTranslationHotkeyMatchesMouseEvent } from "../node-translation-hotkey"

describe("node translation hotkey", () => {
  it("records keyboard single keys", () => {
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }))).toBe("A")
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "F8", code: "F8" }))).toBe("F8")
  })

  it("records supported preset modifier keys", () => {
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "Control" }))).toBe("control")
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "Alt" }))).toBe("alt")
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "Shift" }))).toBe("shift")
  })

  it("rejects keyboard combinations and invalid keys", () => {
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "A", altKey: true, code: "KeyA" }))).toBeNull()
    expect(keyboardEventToNodeTranslationHotkey(new KeyboardEvent("keydown", { key: "Escape" }))).toBeNull()
    expect(isValidConfiguredNodeTranslationHotkey("Alt+E")).toBe(false)
  })

  it("records mouse side buttons only", () => {
    expect(mouseEventToNodeTranslationHotkey(new MouseEvent("mousedown", { button: 3 }))).toBe("mouseButton4")
    expect(mouseEventToNodeTranslationHotkey(new MouseEvent("mousedown", { button: 4 }))).toBe("mouseButton5")
    expect(mouseEventToNodeTranslationHotkey(new MouseEvent("pointerdown", { button: 0, buttons: 8 }))).toBe("mouseButton4")
    expect(mouseEventToNodeTranslationHotkey(new MouseEvent("pointerdown", { button: 0, buttons: 16 }))).toBe("mouseButton5")
    expect(mouseEventToNodeTranslationHotkey(new MouseEvent("mousedown", { button: 1 }))).toBeNull()
  })

  it("matches configured keyboard and mouse hotkeys", () => {
    expect(nodeTranslationHotkeyMatchesKeyboardEvent("A", new KeyboardEvent("keydown", { key: "a", code: "KeyA" }))).toBe(true)
    expect(nodeTranslationHotkeyMatchesKeyboardEvent("A", new KeyboardEvent("keydown", { key: "a", code: "KeyA", altKey: true }))).toBe(false)
    expect(nodeTranslationHotkeyMatchesMouseEvent("mouseButton4", new MouseEvent("mousedown", { button: 3 }))).toBe(true)
    expect(nodeTranslationHotkeyMatchesMouseEvent("mouseButton4", new MouseEvent("pointerdown", { button: 0, buttons: 8 }))).toBe(true)
    expect(nodeTranslationHotkeyMatchesMouseEvent("mouseButton4", new MouseEvent("mousedown", { button: 4 }))).toBe(false)
  })

  it("formats built-in and custom hotkeys", () => {
    expect(formatNodeTranslationHotkey("control")).toBe("⌃")
    expect(formatNodeTranslationHotkey("mouseButton4")).toBe("M4")
    expect(formatNodeTranslationHotkey("A")).toBe("A")
  })
})
