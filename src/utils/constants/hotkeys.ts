export const HOTKEYS = ["control", "alt", "shift", "backtick", "clickAndHold", "mouseButton4", "mouseButton5"] as const

export const HOTKEY_ICONS: Record<typeof HOTKEYS[number], string> = {
  control: "⌃",
  alt: "⌥",
  shift: "⇧",
  backtick: "`",
  clickAndHold: "⏱",
  mouseButton4: "M4",
  mouseButton5: "M5",
}
