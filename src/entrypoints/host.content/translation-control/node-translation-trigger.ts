import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { isImmersiveReadingEnabledForUrl } from "@/utils/immersive-reading"
import { isClickAndHoldNodeTranslationHotkey, isMouseNodeTranslationHotkey, mouseEventToNodeTranslationHotkey, nodeTranslationHotkeyMatchesKeyboardEvent, nodeTranslationHotkeyMatchesMouseEvent } from "@/utils/node-translation-hotkey"

const CLICK_AND_HOLD_TRIGGER_MS = 1000
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6
const MOUSEMOVE_THROTTLE_MS = 300
const MOUSEMOVE_DISTANCE_THRESHOLD = 3
const MOUSE_SIDE_BUTTON_TRIGGER_DEDUP_MS = 350
const MOUSE_SIDE_BUTTON_TRIGGER_EVENTS = new Set(["pointerdown", "mousedown", "pointerup", "mouseup", "auxclick"])

export interface NodeTranslationTriggerOptions {
  getConfig: () => Promise<Config | null>
  getCachedConfig?: () => Config | null
  onTrigger: (point: Point, config: Config) => void | Promise<void>
  shouldIgnoreEvent?: () => boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA")
    return true
  if (target.isContentEditable)
    return true
  return false
}

/**
 * Registers the shared node-translation interaction state machine.
 *
 * The full host content script uses this to translate immediately while keeping
 * the hotkey and click-and-hold handling in one place.
 */
export function registerNodeTranslationTriggerListeners({
  getConfig,
  getCachedConfig = () => null,
  onTrigger,
  shouldIgnoreEvent = () => false,
}: NodeTranslationTriggerOptions): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const mousePosition: Point = { x: 0, y: 0 }
  let hasMousePosition = false

  const updateMousePosition = (point: Point) => {
    mousePosition.x = point.x
    mousePosition.y = point.y
    hasMousePosition = true
  }

  const getDeepestHoveredElement = (): Element | null => {
    const hoveredElements = document.querySelectorAll(":hover")
    return hoveredElements.item(hoveredElements.length - 1)
  }

  const getElementCenterPoint = (element: Element): Point | null => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0)
      return null

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  const resolveTriggerPoint = (): Point => {
    if (hasMousePosition)
      return { ...mousePosition }

    const hoveredElement = getDeepestHoveredElement()
    const hoveredPoint = hoveredElement ? getElementCenterPoint(hoveredElement) : null
    return hoveredPoint ?? { ...mousePosition }
  }

  // --- Mousemove: throttled + distance threshold ---
  let lastMoveX = 0
  let lastMoveY = 0
  let moveThrottleTimer: ReturnType<typeof setTimeout> | null = null

  // --- Click-and-hold state ---
  let isMousePressed = false
  let clickAndHoldTriggered = false
  let mousePressPosition: Point | null = null
  let clickAndHoldTimerId: ReturnType<typeof setTimeout> | null = null
  let activeMouseSideButtonTranslation: string | null = null
  let activeMouseSideButtonTranslationTimer: ReturnType<typeof setTimeout> | null = null

  const clearClickAndHoldTimer = () => {
    if (clickAndHoldTimerId) {
      clearTimeout(clickAndHoldTimerId)
      clickAndHoldTimerId = null
    }
  }

  const clearActiveMouseSideButtonTranslationTimer = () => {
    if (activeMouseSideButtonTranslationTimer) {
      clearTimeout(activeMouseSideButtonTranslationTimer)
      activeMouseSideButtonTranslationTimer = null
    }
  }

  const resetActiveMouseSideButtonTranslationSoon = () => {
    clearActiveMouseSideButtonTranslationTimer()
    activeMouseSideButtonTranslationTimer = setTimeout(() => {
      activeMouseSideButtonTranslation = null
      activeMouseSideButtonTranslationTimer = null
    }, MOUSE_SIDE_BUTTON_TRIGGER_DEDUP_MS)
  }

  const getCurrentConfig = async (): Promise<Config | null> => {
    const config = await getConfig()
    if (signal.aborted)
      return null
    return config
  }

  const isImmersiveReadingEnabled = (config: Config): boolean => {
    return isImmersiveReadingEnabledForUrl(config.immersiveReading?.enabledPatterns)
  }

  const triggerNodeTranslation = (point: Point, config: Config) => {
    void onTrigger(point, config)
  }

  const blockMouseSideButtonNavigation = (event: MouseEvent | PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  const shouldTriggerMouseSideButtonTranslation = (
    event: MouseEvent | PointerEvent,
    config: Config,
    mouseHotkey: string,
    immersiveReadingEnabled: boolean,
  ): boolean => {
    return immersiveReadingEnabled
      && MOUSE_SIDE_BUTTON_TRIGGER_EVENTS.has(event.type)
      && config.translate.node.enabled
      && nodeTranslationHotkeyMatchesMouseEvent(config.translate.node.hotkey, event)
      && activeMouseSideButtonTranslation !== mouseHotkey
  }

  const resolveMouseSideButtonTriggerPoint = (event: MouseEvent | PointerEvent): Point => {
    const hoveredElement = getDeepestHoveredElement()
    const hoveredPoint = hoveredElement ? getElementCenterPoint(hoveredElement) : null
    if (hoveredPoint)
      return hoveredPoint

    if (hasMousePosition)
      return { ...mousePosition }

    return { x: event.clientX, y: event.clientY }
  }

  const handleMouseSideButton = (event: MouseEvent | PointerEvent) => {
    if (shouldIgnoreEvent())
      return

    const mouseHotkey = mouseEventToNodeTranslationHotkey(event)
    if (!mouseHotkey)
      return

    const config = getCachedConfig()
    if (!config)
      return

    const isConfiguredMouseHotkey = config.translate.node.enabled
      && nodeTranslationHotkeyMatchesMouseEvent(config.translate.node.hotkey, event)
    const immersiveReadingEnabled = isImmersiveReadingEnabled(config)
    const shouldBlockNavigation = immersiveReadingEnabled
    const shouldTriggerTranslation = isConfiguredMouseHotkey
      && shouldTriggerMouseSideButtonTranslation(event, config, mouseHotkey, immersiveReadingEnabled)

    if (shouldBlockNavigation)
      blockMouseSideButtonNavigation(event)

    if (event.type === "pointerup" || event.type === "mouseup" || event.type === "auxclick") {
      if (activeMouseSideButtonTranslation === mouseHotkey)
        resetActiveMouseSideButtonTranslationSoon()
    }

    if (!shouldTriggerTranslation || isEditableTarget(event.target))
      return

    activeMouseSideButtonTranslation = mouseHotkey
    resetActiveMouseSideButtonTranslationSoon()
    const point = resolveMouseSideButtonTriggerPoint(event)
    updateMousePosition(point)
    triggerNodeTranslation(point, config)
  }

  document.addEventListener("mousemove", (event) => {
    if (shouldIgnoreEvent())
      return

    // Distance threshold: ignore tiny movements (trackpad tremor, mouse jitter)
    if (
      Math.abs(event.clientX - lastMoveX) + Math.abs(event.clientY - lastMoveY)
      <= MOUSEMOVE_DISTANCE_THRESHOLD
    ) {
      return
    }

    // Click-and-hold move cancellation (always immediate, no throttle)
    if (isMousePressed && mousePressPosition) {
      const deltaX = event.clientX - mousePressPosition.x
      const deltaY = event.clientY - mousePressPosition.y
      if (Math.hypot(deltaX, deltaY) > CLICK_AND_HOLD_MOVE_TOLERANCE) {
        isMousePressed = false
        mousePressPosition = null
        clearClickAndHoldTimer()
      }
    }

    // Throttled position update
    if (moveThrottleTimer)
      return

    moveThrottleTimer = setTimeout(() => {
      moveThrottleTimer = null
    }, MOUSEMOVE_THROTTLE_MS)

    updateMousePosition({ x: event.clientX, y: event.clientY })
    lastMoveX = event.clientX
    lastMoveY = event.clientY
  }, { signal })

  const updateMousePositionFromEvent = (event: MouseEvent | PointerEvent) => {
    if (shouldIgnoreEvent())
      return

    updateMousePosition({ x: event.clientX, y: event.clientY })
    lastMoveX = event.clientX
    lastMoveY = event.clientY
  }

  document.addEventListener("mouseover", updateMousePositionFromEvent, { signal })
  document.addEventListener("pointerover", updateMousePositionFromEvent, { signal })

  const sideButtonEventOptions = { signal, capture: true }
  const sideButtonEventTypes = ["pointerdown", "pointerup", "mousedown", "mouseup", "auxclick"] as const
  for (const type of sideButtonEventTypes) {
    window.addEventListener(type, handleMouseSideButton, sideButtonEventOptions)
    document.addEventListener(type, handleMouseSideButton, sideButtonEventOptions)
  }

  let isHotkeyPressed = false
  let isHotkeySessionPure = true
  let timerId: ReturnType<typeof setTimeout> | null = null
  let actionTriggered = false
  let activeKeyboardHotkey: string | null = null

  const resetHotkeySession = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
    isHotkeyPressed = false
    isHotkeySessionPure = true
    actionTriggered = false
    activeKeyboardHotkey = null
  }

  document.addEventListener("mousedown", (event) => {
    void (async () => {
      if (shouldIgnoreEvent())
        return
      if (event.button !== 0)
        return
      if (isEditableTarget(event.target))
        return

      const config = await getCurrentConfig()
      if (!config || !config.translate.node.enabled || !isClickAndHoldNodeTranslationHotkey(config.translate.node.hotkey))
        return

      isMousePressed = true
      clickAndHoldTriggered = false
      mousePressPosition = { x: event.clientX, y: event.clientY }

      clearClickAndHoldTimer()
      clickAndHoldTimerId = setTimeout(() => {
        void (async () => {
          if (shouldIgnoreEvent())
            return
          if (!isMousePressed || !mousePressPosition || clickAndHoldTriggered)
            return

          const currentConfig = await getCurrentConfig()
          if (!currentConfig || !currentConfig.translate.node.enabled || !isClickAndHoldNodeTranslationHotkey(currentConfig.translate.node.hotkey))
            return

          triggerNodeTranslation(mousePressPosition, currentConfig)
          clickAndHoldTriggered = true
        })()
      }, CLICK_AND_HOLD_TRIGGER_MS)
    })()
  }, { signal })

  document.addEventListener("mouseup", (event) => {
    if (shouldIgnoreEvent())
      return
    if (event.button !== 0)
      return
    if (!isMousePressed && !clickAndHoldTimerId)
      return

    isMousePressed = false
    clickAndHoldTriggered = false
    mousePressPosition = null
    clearClickAndHoldTimer()
  }, { signal })

  document.addEventListener("keydown", (event) => {
    void (async () => {
      if (shouldIgnoreEvent())
        return
      if (isEditableTarget(event.target))
        return

      const config = await getCurrentConfig()
      if (!config || !config.translate.node.enabled || isClickAndHoldNodeTranslationHotkey(config.translate.node.hotkey) || isMouseNodeTranslationHotkey(config.translate.node.hotkey)) {
        resetHotkeySession()
        return
      }

      const configuredHotkey = config.translate.node.hotkey

      if (nodeTranslationHotkeyMatchesKeyboardEvent(configuredHotkey, event)) {
        if (!isHotkeyPressed) {
          isHotkeyPressed = true
          activeKeyboardHotkey = configuredHotkey
          timerId = setTimeout(() => {
            void (async () => {
              if (shouldIgnoreEvent())
                return
              if (!isHotkeySessionPure || !isHotkeyPressed) {
                timerId = null
                return
              }

              const currentConfig = await getCurrentConfig()
              if (!currentConfig || !currentConfig.translate.node.enabled || isClickAndHoldNodeTranslationHotkey(currentConfig.translate.node.hotkey) || isMouseNodeTranslationHotkey(currentConfig.translate.node.hotkey)) {
                timerId = null
                return
              }
              if (currentConfig.translate.node.hotkey !== activeKeyboardHotkey) {
                timerId = null
                return
              }

              triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
              actionTriggered = true
              timerId = null
            })()
          }, 1000)

          if (!isHotkeySessionPure && timerId) {
            clearTimeout(timerId)
            timerId = null
          }
        }
      }
      else {
        isHotkeySessionPure = false
        if (isHotkeyPressed && timerId) {
          clearTimeout(timerId)
          timerId = null
        }
      }
    })()
  }, { signal })

  document.addEventListener("keyup", (event) => {
    void (async () => {
      if (shouldIgnoreEvent())
        return
      if (isEditableTarget(event.target))
        return

      const config = await getCurrentConfig()
      const isActiveHotkeyRelease = activeKeyboardHotkey
        ? nodeTranslationHotkeyMatchesKeyboardEvent(activeKeyboardHotkey, event)
        : false

      if (!config || !config.translate.node.enabled || isClickAndHoldNodeTranslationHotkey(config.translate.node.hotkey) || isMouseNodeTranslationHotkey(config.translate.node.hotkey)) {
        if (isActiveHotkeyRelease)
          resetHotkeySession()
        return
      }

      if (nodeTranslationHotkeyMatchesKeyboardEvent(config.translate.node.hotkey, event) || isActiveHotkeyRelease) {
        if (isHotkeyPressed && isHotkeySessionPure) {
          if (timerId) {
            clearTimeout(timerId)
            timerId = null
          }
          if (!actionTriggered) {
            const currentConfig = await getCurrentConfig()
            if (!currentConfig || !currentConfig.translate.node.enabled || isClickAndHoldNodeTranslationHotkey(currentConfig.translate.node.hotkey) || isMouseNodeTranslationHotkey(currentConfig.translate.node.hotkey))
              return

            triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
          }
        }
        resetHotkeySession()
      }
    })()
  }, { signal })

  return () => {
    ac.abort()
    resetHotkeySession()
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    clearClickAndHoldTimer()
    activeMouseSideButtonTranslation = null
    clearActiveMouseSideButtonTranslationTimer()
  }
}
