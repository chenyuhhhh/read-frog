import { describe, expect, it } from "vitest"
import { isOptionalReceiverMessageError } from "../message-errors"

describe("isOptionalReceiverMessageError", () => {
  it("matches Chrome no-receiver errors", () => {
    expect(isOptionalReceiverMessageError(
      new Error("Could not establish connection. Receiving end does not exist."),
    )).toBe(true)
  })

  it("matches message port closed errors", () => {
    expect(isOptionalReceiverMessageError(
      new Error("The message port closed before a response was received."),
    )).toBe(true)
  })

  it("does not match unrelated errors", () => {
    expect(isOptionalReceiverMessageError(new Error("Unexpected failure"))).toBe(false)
  })
})
