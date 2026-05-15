const OPTIONAL_RECEIVER_ERROR_PATTERNS = [
  "Could not establish connection. Receiving end does not exist",
  "Receiving end does not exist",
  "The message port closed before a response was received",
]

export function isOptionalReceiverMessageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return OPTIONAL_RECEIVER_ERROR_PATTERNS.some(pattern => message.includes(pattern))
}
