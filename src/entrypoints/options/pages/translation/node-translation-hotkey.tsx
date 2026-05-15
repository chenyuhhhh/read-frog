import { i18n } from "#imports"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { NodeTranslationHotkeyControl } from "@/components/node-translation-hotkey-control"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  return (
    <ConfigCard
      id="node-translation-hotkey"
      title={i18n.t("options.translation.nodeTranslationHotkey.title")}
      description={i18n.t("options.translation.nodeTranslationHotkey.description")}
    >
      <div className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="node-translation-hotkey-toggle">
              {i18n.t("options.translation.nodeTranslationHotkey.enable")}
            </FieldLabel>
          </FieldContent>
          <Switch
            id="node-translation-hotkey-toggle"
            checked={translateConfig.node.enabled}
            onCheckedChange={(checked) => {
              void setTranslateConfig(
                deepmerge(translateConfig, { node: { enabled: checked } }),
              )
            }}
          />
        </Field>
        <NodeTranslationHotkeyControl
          hotkey={translateConfig.node.hotkey}
          onChange={(hotkey) => {
            void setTranslateConfig(
              deepmerge(translateConfig, { node: { hotkey } }),
            )
          }}
          disabled={!translateConfig.node.enabled}
          className={!translateConfig.node.enabled ? "opacity-50" : undefined}
        />
      </div>
    </ConfigCard>
  )
}
