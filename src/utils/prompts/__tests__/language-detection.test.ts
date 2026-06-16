import { describe, expect, it } from "vitest"
import { getLanguageDetectionSystemPrompt, parseDetectedLanguageCode } from "../language-detection"

describe("language detection prompt", () => {
  it("asks the model to return raw JSON with a language code", () => {
    const prompt = getLanguageDetectionSystemPrompt()

    expect(prompt).toContain("raw JSON")
    expect(prompt).toContain("code")
  })
})

describe("parseDetectedLanguageCode", () => {
  it("parses a fenced JSON response from the model", () => {
    expect(parseDetectedLanguageCode(`\`\`\`json
{
  "reason": "This is Simplified Chinese.",
  "code": "cmn"
}
\`\`\``)).toBe("cmn")
  })

  it("returns null for invalid JSON output", () => {
    expect(parseDetectedLanguageCode("cmn")).toBeNull()
  })
})
