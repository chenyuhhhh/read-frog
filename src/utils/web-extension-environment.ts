interface RuntimeCandidate {
  runtime?: {
    id?: unknown
  }
}

function hasRuntimeId(value: unknown): value is { runtime: { id: string } } {
  const runtimeId = (value as RuntimeCandidate | undefined)?.runtime?.id
  return typeof runtimeId === "string" && runtimeId.length > 0
}

export function isWebExtensionRuntimeAvailable(root: unknown = globalThis): boolean {
  const candidate = root as { browser?: RuntimeCandidate, chrome?: RuntimeCandidate }
  return hasRuntimeId(candidate.browser) || hasRuntimeId(candidate.chrome)
}
