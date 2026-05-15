import { normalizeKeyName, PUNCTUATION_CODE_MAP } from "@tanstack/hotkeys"

const LETTER_CODE_RE = /^[A-Z]$/i
const DIGIT_CODE_RE = /^\d$/

export function resolveKeyboardEventKey(event: KeyboardEvent): string {
  const normalizedKey = normalizeKeyName(event.key)
  if (event.code && (normalizedKey === "Dead" || event.altKey)) {
    if (event.code.startsWith("Key")) {
      const codeLetter = event.code.slice(3)
      if (LETTER_CODE_RE.test(codeLetter)) {
        return codeLetter.toUpperCase()
      }
    }

    if (event.code.startsWith("Digit")) {
      const codeDigit = event.code.slice(5)
      if (DIGIT_CODE_RE.test(codeDigit)) {
        return codeDigit
      }
    }

    if (event.code in PUNCTUATION_CODE_MAP) {
      return PUNCTUATION_CODE_MAP[event.code]
    }
  }

  return normalizedKey
}
