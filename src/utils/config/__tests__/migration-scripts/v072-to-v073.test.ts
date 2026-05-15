import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("adds immersiveReading.enabledPatterns with an empty default", () => {
    const migrated = migrate({})

    expect(migrated.immersiveReading.enabledPatterns).toEqual([])
  })

  it("preserves existing immersiveReading.enabledPatterns", () => {
    const migrated = migrate({
      immersiveReading: {
        enabledPatterns: ["example.com"],
      },
    })

    expect(migrated.immersiveReading.enabledPatterns).toEqual(["example.com"])
  })
})
