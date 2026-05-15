import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { NodeTranslationHotkeyControl } from "@/components/node-translation-hotkey-control"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export default function NodeTranslationHotkeySelector() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  const handleNodeTranslationEnabledChange = async (checked: boolean) => {
    await setTranslateConfig(deepmerge(translateConfig, { node: { enabled: checked } }))
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <NodeTranslationHotkeyControl
        hotkey={translateConfig.node.hotkey}
        compact
        className="min-w-0 flex-1 text-[13px] font-medium"
        onChange={(hotkey) => {
          void setTranslateConfig(deepmerge(translateConfig, { node: { hotkey } }))
        }}
      />
      <Switch
        checked={translateConfig.node.enabled}
        onCheckedChange={checked => void handleNodeTranslationEnabledChange(checked)}
      />
    </div>
  )
}
