// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  removeOrShowNodeTranslation: vi.fn(),
  sendMessage: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslation: mocks.removeOrShowNodeTranslation,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mocks.sendMessage,
}))

function createConfig({
  hotkey = "backtick",
  immersiveReadingPatterns = [],
}: {
  hotkey?: Config["translate"]["node"]["hotkey"]
  immersiveReadingPatterns?: string[]
} = {}): Config {
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

function dispatchMouseEvent(type: "mousemove" | "mouseover" | "mousedown", init: MouseEventInit) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

async function triggerBacktickNodeTranslation() {
  dispatchMouseEvent("mousemove", { clientX: 15, clientY: 25 })
  dispatchKeyboardEvent("keydown", "`")
  await Promise.resolve()
  dispatchKeyboardEvent("keyup", "`")
}

describe("registerNodeTranslationTriggers", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.clearAllMocks()
  })

  it("requests current iframe injection after a successful top-frame node translation", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    mocks.sendMessage.mockResolvedValue(undefined)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledWith(
        { x: 15, y: 25 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ enabled: true }),
          }),
        }),
      )
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        "injectCurrentIframesAfterTopFrameNodeTranslation",
        undefined,
      )
    })
  })

  it("does not request iframe injection when node translation finds no translatable node", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(false)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalled()
    })
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it("requests current iframe injection only once for repeated successful node translations", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    mocks.sendMessage.mockResolvedValue(undefined)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    })

    await triggerBacktickNodeTranslation()
    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledTimes(2)
    })
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
  })

  it("uses initial config immediately for immersive reading side-button triggers", () => {
    const initialConfig = createConfig({
      hotkey: "mouseButton4",
      immersiveReadingPatterns: [window.location.hostname],
    })
    mocks.getLocalConfig.mockReturnValue(new Promise(() => {}))
    mocks.removeOrShowNodeTranslation.mockResolvedValue(false)

    teardown = registerNodeTranslationTriggers(initialConfig)

    const event = dispatchMouseEvent("mousedown", { button: 3, clientX: 15, clientY: 25 })

    expect(event.defaultPrevented).toBe(true)
    expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledWith(
      { x: 15, y: 25 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "mouseButton4" }),
        }),
      }),
    )
  })
})
