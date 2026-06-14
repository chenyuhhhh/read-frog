// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChartContainer } from "../chart"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({
    children,
    initialDimension,
  }: {
    children: React.ReactNode
    initialDimension?: { width: number, height: number }
  }) => (
    <div
      data-initial-height={initialDimension?.height}
      data-initial-width={initialDimension?.width}
      data-testid="responsive-container"
    >
      {children}
    </div>
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

  it("starts recharts with a positive initial dimension", () => {
    const { getByTestId } = render(
      <ChartContainer config={config}>
        <div>Chart</div>
      </ChartContainer>,
    )

    expect(getByTestId("responsive-container")).toHaveAttribute("data-initial-height", "1")
    expect(getByTestId("responsive-container")).toHaveAttribute("data-initial-width", "1")
  })
})
