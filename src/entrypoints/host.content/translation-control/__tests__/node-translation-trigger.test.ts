// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggerListeners } from "../node-translation-trigger"

function createConfig(
  hotkey: Config["translate"]["node"]["hotkey"],
  immersiveReadingPatterns: string[] = [],
): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey,
      },
    },
    immersiveReading: {
      enabledPatterns: immersiveReadingPatterns,
    },
  } as Config
}

function dispatchKeyboardEvent(type: "keydown" | "keyup", key: string) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
}

function dispatchMouseEvent(
  type: "mousemove" | "mouseover" | "mousedown" | "mouseup" | "auxclick" | "pointerdown" | "pointerup",
  init: MouseEventInit,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

describe("registerNodeTranslationTriggerListeners", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("triggers backtick node translation at the latest mouse position", async () => {
    const onTrigger = vi.fn()
    const getConfig = vi.fn(() => Promise.resolve(createConfig("backtick")))

    teardown = registerNodeTranslationTriggerListeners({
      getConfig,
      onTrigger,
    })

    dispatchMouseEvent("mousemove", { clientX: 50, clientY: 60 })
    dispatchKeyboardEvent("keydown", "`")
    await vi.waitFor(() => {
      expect(getConfig).toHaveBeenCalledTimes(1)
    })
    dispatchKeyboardEvent("keyup", "`")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        { x: 50, y: 60 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("triggers node translation at the latest mouseover position", async () => {
    const onTrigger = vi.fn()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "Control")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        { x: 70, y: 80 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "control" }),
          }),
        }),
      )
    })
  })

  it("falls back to the hovered element center when no mouse position was recorded", async () => {
    const onTrigger = vi.fn()
    const hovered = document.createElement("p")
    document.body.append(hovered)
    vi.spyOn(hovered, "getBoundingClientRect").mockReturnValue({
      left: 20,
      top: 30,
      width: 100,
      height: 40,
      right: 120,
      bottom: 70,
      x: 20,
      y: 30,
      toJSON: () => ({}),
    } as DOMRect)
    vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (selector === ":hover") {
        const hoveredElements = [document.documentElement, document.body, hovered]
        return {
          length: hoveredElements.length,
          item: (index: number) => hoveredElements[index] ?? null,
        } as unknown as NodeListOf<Element>
      }

      return [] as unknown as NodeListOf<Element>
    })

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("backtick")),
      onTrigger,
    })

    dispatchKeyboardEvent("keydown", "`")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "`")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        { x: 70, y: 50 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("triggers click-and-hold node translation after the hold delay", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 30, clientY: 40 })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)

    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "clickAndHold" }),
        }),
      }),
    )
  })

  it("triggers mouse side button node translation and blocks navigation during immersive reading", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const event = dispatchMouseEvent("mousedown", { button: 3, clientX: 30, clientY: 40 })

    expect(event.defaultPrevented).toBe(true)
    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })

  it("blocks every Chrome side-button navigation event and triggers once when the side button is the hotkey during immersive reading", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const events = [
      dispatchMouseEvent("pointerdown", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("mouseup", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("pointerup", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("auxclick", { button: 3, clientX: 30, clientY: 40 }),
    ]

    expect(events.every(event => event.defaultPrevented)).toBe(true)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })

  it("does not trigger side button translation twice when pointerdown is followed by mousedown", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const pointerDown = dispatchMouseEvent("pointerdown", { button: 3, clientX: 30, clientY: 40 })
    const mouseDown = dispatchMouseEvent("mousedown", { button: 3, clientX: 31, clientY: 41 })

    expect(pointerDown.defaultPrevented).toBe(true)
    expect(mouseDown.defaultPrevented).toBe(true)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })

  it("triggers mouse side button translation from the buttons bitmask during immersive reading", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const event = dispatchMouseEvent("pointerdown", { button: 0, buttons: 8, clientX: 30, clientY: 40 })

    expect(event.defaultPrevented).toBe(true)
    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })

  it("triggers once when the browser only emits side-button release events during immersive reading", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const mouseUp = dispatchMouseEvent("mouseup", { button: 3, clientX: 30, clientY: 40 })
    const auxClick = dispatchMouseEvent("auxclick", { button: 3, clientX: 30, clientY: 40 })

    expect(mouseUp.defaultPrevented).toBe(true)
    expect(auxClick.defaultPrevented).toBe(true)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it("uses the latest hovered position when a side-button event has no useful coordinates", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchMouseEvent("pointerdown", { button: 3, clientX: 0, clientY: 0 })

    expect(onTrigger).toHaveBeenCalledWith(
      { x: 70, y: 80 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })

  it("blocks side button navigation during immersive reading without translating", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("control", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const event = dispatchMouseEvent("mousedown", { button: 3, clientX: 30, clientY: 40 })

    expect(event.defaultPrevented).toBe(true)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("blocks every Chrome side-button navigation event during immersive reading", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("control", [window.location.hostname])

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const events = [
      dispatchMouseEvent("pointerdown", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("mouseup", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("pointerup", { button: 3, clientX: 30, clientY: 40 }),
      dispatchMouseEvent("auxclick", { button: 3, clientX: 30, clientY: 40 }),
    ]

    expect(events.every(event => event.defaultPrevented)).toBe(true)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("does not block side button navigation when immersive reading is off and the side button is not the hotkey", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("control")

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const event = dispatchMouseEvent("mousedown", { button: 3, clientX: 30, clientY: 40 })

    expect(event.defaultPrevented).toBe(false)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("does not block or trigger a configured side button hotkey when immersive reading is off", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4")

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const forward = dispatchMouseEvent("mousedown", { button: 3, clientX: 30, clientY: 40 })
    const backward = dispatchMouseEvent("mousedown", { button: 4, clientX: 30, clientY: 40 })

    expect(forward.defaultPrevented).toBe(false)
    expect(backward.defaultPrevented).toBe(false)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("blocks side button navigation in editable targets without translating", async () => {
    const onTrigger = vi.fn()
    const config = createConfig("mouseButton4", [window.location.hostname])
    const input = document.createElement("input")
    document.body.append(input)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(config),
      getCachedConfig: () => config,
      onTrigger,
    })

    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 3, clientX: 30, clientY: 40 })
    input.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("does not trigger while the caller says the event should be ignored", async () => {
    const onTrigger = vi.fn()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      shouldIgnoreEvent: () => true,
    })

    dispatchMouseEvent("mousemove", { clientX: 50, clientY: 60 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "Control")
    await Promise.resolve()

    expect(onTrigger).not.toHaveBeenCalled()
  })
})
