// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChartContainer } from "../chart"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => null,
  Legend: () => null,
}))

describe("chart container", () => {
  const config = {
    requests: {
      color: "var(--color-chart-1)",
      label: "Requests",
    },
  }

  it("keeps the aspect ratio class by default", () => {
    const { container } = render(
      <ChartContainer config={config}>
        <div>Chart</div>
      </ChartContainer>,
    )

    expect(container.firstElementChild).toHaveClass("aspect-video")
  })

  it("omits the aspect ratio class when disabled", () => {
    const { container } = render(
      <ChartContainer config={config} useAspectRatio={false}>
        <div>Chart</div>
      </ChartContainer>,
    )

    expect(container.firstElementChild).not.toHaveClass("aspect-video")
  })
})
