import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { formatNodeTranslationHotkey, keyboardEventToNodeTranslationHotkey, mouseEventToNodeTranslationHotkey } from "@/utils/node-translation-hotkey"
import { cn } from "@/utils/styles/utils"

const RECORD_VALUE = "__record_node_translation_hotkey__"

export function NodeTranslationHotkeyControl({
  hotkey,
  onChange,
  disabled = false,
  compact = false,
  className,
}: {
  hotkey: string
  onChange: (hotkey: string) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}) {
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)
  const isPresetHotkey = useMemo(() => HOTKEYS.includes(hotkey as typeof HOTKEYS[number]), [hotkey])

  const endRecording = useCallback((nextHotkey: string | null) => {
    isRecordingRef.current = false
    setIsRecording(false)

    if (nextHotkey) {
      onChange(nextHotkey)
    }
  }, [onChange])

  const startRecording = useCallback(() => {
    if (disabled || isRecordingRef.current) {
      return
    }

    isRecordingRef.current = true
    setIsRecording(true)
  }, [disabled])

  useEffect(() => {
    if (!isRecording) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (!isRecordingRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.key === "Escape") {
        endRecording(null)
        return
      }

      const nextHotkey = keyboardEventToNodeTranslationHotkey(event)
      if (nextHotkey) {
        endRecording(nextHotkey)
      }
    }

    const handleMouse = (event: MouseEvent) => {
      if (!isRecordingRef.current) {
        return
      }

      const nextHotkey = mouseEventToNodeTranslationHotkey(event)
      if (!nextHotkey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      endRecording(nextHotkey)
    }

    document.addEventListener("keydown", handleKeydown, true)
    document.addEventListener("mousedown", handleMouse, true)
    document.addEventListener("auxclick", handleMouse, true)
    return () => {
      document.removeEventListener("keydown", handleKeydown, true)
      document.removeEventListener("mousedown", handleMouse, true)
      document.removeEventListener("auxclick", handleMouse, true)
    }
  }, [endRecording, isRecording])

  const recordLabel = isRecording
    ? i18n.t("nodeTranslationHotkeyRecorder.recording")
    : i18n.t("nodeTranslationHotkeyRecorder.record")

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <Select
        value={hotkey}
        disabled={disabled || isRecording}
        onValueChange={(value: string | null) => {
          if (!value) {
            return
          }

          if (value === RECORD_VALUE) {
            startRecording()
            return
          }

          onChange(value)
        }}
      >
        <SelectTrigger
          size={compact ? "sm" : "default"}
          className={cn("min-w-0 flex-1", compact && "h-7 border-none bg-transparent! px-0 shadow-none focus-visible:ring-0")}
        >
          <SelectValue render={<span />}>
            <NodeTranslationHotkeyActionLabel hotkey={hotkey} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-fit">
          <SelectGroup>
            {!isPresetHotkey && (
              <SelectItem value={hotkey}>
                <NodeTranslationHotkeyLabel hotkey={hotkey} />
              </SelectItem>
            )}
            {HOTKEYS.map(item => (
              <SelectItem key={item} value={item}>
                <NodeTranslationHotkeyLabel hotkey={item} />
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={RECORD_VALUE}>
              <span className="flex items-center gap-2">
                <Icon icon="tabler:keyboard" className="size-4" />
                {i18n.t("nodeTranslationHotkeyRecorder.record")}
              </span>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={isRecording ? "secondary" : "outline"}
        size={compact ? "icon-xs" : "sm"}
        disabled={disabled}
        aria-label={recordLabel}
        title={recordLabel}
        onClick={startRecording}
      >
        <Icon icon={isRecording ? "tabler:circle-dot" : "tabler:keyboard"} className="size-4" />
        {!compact && <span>{recordLabel}</span>}
      </Button>
    </div>
  )
}

function NodeTranslationHotkeyActionLabel({ hotkey }: { hotkey: string }) {
  if (hotkey === "clickAndHold") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <NodeTranslationHotkeyLabel hotkey={hotkey} />
        <span className="truncate">{i18n.t("popup.translateParagraph")}</span>
      </span>
    )
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 truncate">
      <span className="truncate">{i18n.t("popup.hover")}</span>
      <span>+</span>
      <NodeTranslationHotkeyLabel hotkey={hotkey} />
      <span className="truncate">{i18n.t("popup.translateParagraph")}</span>
    </span>
  )
}

function NodeTranslationHotkeyLabel({ hotkey }: { hotkey: string }) {
  const icon = hotkey in HOTKEY_ICONS
    ? HOTKEY_ICONS[hotkey as keyof typeof HOTKEY_ICONS]
    : formatNodeTranslationHotkey(hotkey)
  const label = hotkey in HOTKEY_ICONS
    ? i18n.t(`hotkey.${hotkey}` as never)
    : formatNodeTranslationHotkey(hotkey)

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="font-mono text-xs">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}
