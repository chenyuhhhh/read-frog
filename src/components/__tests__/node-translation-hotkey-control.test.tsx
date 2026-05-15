// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { NodeTranslationHotkeyControl } from "../node-translation-hotkey-control"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

describe("node translation hotkey control", () => {
  it("records keyboard single keys", async () => {
    const onChange = vi.fn()
    render(<NodeTranslationHotkeyControl hotkey="control" onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "nodeTranslationHotkeyRecorder.record" }))
    fireEvent.keyDown(document, { key: "a", code: "KeyA" })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("A")
    })
  })

  it("records mouse side buttons", async () => {
    const onChange = vi.fn()
    render(<NodeTranslationHotkeyControl hotkey="control" onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "nodeTranslationHotkeyRecorder.record" }))
    fireEvent.mouseDown(document, { button: 3 })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("mouseButton4")
    })
  })

  it("cancels recording with Escape", async () => {
    const onChange = vi.fn()
    render(<NodeTranslationHotkeyControl hotkey="control" onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: "nodeTranslationHotkeyRecorder.record" }))
    fireEvent.keyDown(document, { key: "Escape" })
    fireEvent.keyDown(document, { key: "a", code: "KeyA" })

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it("does not record while disabled", async () => {
    const onChange = vi.fn()
    render(<NodeTranslationHotkeyControl hotkey="control" onChange={onChange} disabled />)

    fireEvent.click(screen.getByRole("button", { name: "nodeTranslationHotkeyRecorder.record" }))
    fireEvent.keyDown(document, { key: "a", code: "KeyA" })

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})
