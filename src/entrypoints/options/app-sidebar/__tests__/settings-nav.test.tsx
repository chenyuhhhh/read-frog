// @vitest-environment jsdom
import type { ReactElement, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import * as React from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { SettingsNav } from "../settings-nav"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span aria-hidden="true" data-icon={icon} />,
}))

function renderSlot(
  renderElement: ReactElement<Record<string, unknown>> | undefined,
  children: ReactNode,
  props: Record<string, unknown> = {},
) {
  if (renderElement && React.isValidElement(renderElement)) {
    // eslint-disable-next-line react/no-clone-element
    return React.cloneElement(renderElement, {
      ...props,
      children,
    })
  }

  return <button type="button" {...props}>{children}</button>
}

vi.mock("@/components/ui/base-ui/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({
    children,
    render,
  }: {
    children: ReactNode
    render?: ReactElement<Record<string, unknown>>
  }) => renderSlot(render, children),
}))

vi.mock("@/components/ui/base-ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    isActive,
    render,
  }: {
    children: ReactNode
    isActive?: boolean
    render?: ReactElement<Record<string, unknown>>
  }) => renderSlot(render, children, { "data-active": isActive ? "true" : "false" }),
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuSubButton: ({
    children,
    isActive,
    render,
  }: {
    children: ReactNode
    isActive?: boolean
    render?: ReactElement<Record<string, unknown>>
  }) => renderSlot(render, children, { "data-active": isActive ? "true" : "false" }),
  SidebarMenuSubItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe("settings nav", () => {
  it("links to the vocabulary notebook from the settings sidebar", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SettingsNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole("link", { name: "vocabularyNotebook.title" })).toHaveAttribute(
      "href",
      "/vocabulary-notebook",
    )
  })
})
