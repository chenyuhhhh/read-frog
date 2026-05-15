import type { Config } from "@/types/config/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { getLocalConfig } from "@/utils/config/storage"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { removeOrShowNodeTranslation } from "@/utils/host/translate/node-manipulation"
import { sendMessage } from "@/utils/message"
import { registerNodeTranslationTriggerListeners } from "./node-translation-trigger"

/**
 * Registers node translation triggers based on the current config.
 * Returns a teardown function to remove all listeners.
 *
 * Config is read on demand when the interaction fires so long-lived content
 * scripts don't drift if the page was frozen and missed storage events.
 */
export function registerNodeTranslationTriggers(initialConfig: Config | null = null): () => void {
  const ac = new AbortController()
  const { signal } = ac
  let cachedConfig: Config | null = initialConfig ?? DEFAULT_CONFIG

  const getCurrentConfig = async (): Promise<Config | null> => {
    const config = await getLocalConfig()
    if (signal.aborted)
      return null
    cachedConfig = config ?? DEFAULT_CONFIG
    return cachedConfig
  }

  void getCurrentConfig()

  const unwatchConfig = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, (config) => {
    cachedConfig = config
  })

  let hasRequestedIframeInjection = false

  const requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation = () => {
    if (hasRequestedIframeInjection || window !== window.top || signal.aborted)
      return

    hasRequestedIframeInjection = true
    void sendMessage("injectCurrentIframesAfterTopFrameNodeTranslation", undefined)
      .catch(() => undefined)
  }

  const translateNode = async (point: Parameters<typeof removeOrShowNodeTranslation>[0], config: Config) => {
    const didTranslate = await removeOrShowNodeTranslation(point, config)
    if (didTranslate) {
      requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation()
    }
  }

  const teardownTriggerListeners = registerNodeTranslationTriggerListeners({
    getConfig: getCurrentConfig,
    getCachedConfig: () => cachedConfig,
    onTrigger: (point, config) => {
      void translateNode(point, config)
    },
  })

  // Teardown: abort all listeners + cancel pending timers
  return () => {
    ac.abort()
    unwatchConfig()
    teardownTriggerListeners()
  }
}
