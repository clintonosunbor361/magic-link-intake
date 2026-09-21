// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navigation } from "@/components/app-shell/navigation";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(() => "/") }));

vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("mobile staff navigation", () => {
  beforeEach(() => usePathnameMock.mockReturnValue("/"));

  it("opens, closes with Escape, and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    render(<Navigation canManageTeam canManageFinance />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Primary navigation" })).toHaveClass(
      "app-sidebar-open",
    );

    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { name: "Primary navigation" })).not.toHaveClass(
      "app-sidebar-open",
    );
    expect(trigger).toHaveFocus();
  });

  it("collapses and expands the Clients submenu", async () => {
    const user = userEvent.setup();
    render(<Navigation canManageTeam={false} canManageFinance={false} />);

    expect(screen.queryByRole("link", { name: "Generated Links" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand Clients submenu" }));
    expect(screen.getByRole("link", { name: "Generated Links" })).toHaveAttribute(
      "href",
      "/clients/intake-links",
    );
    await user.click(screen.getByRole("button", { name: "Collapse Clients submenu" }));
    expect(screen.queryByRole("link", { name: "Generated Links" })).not.toBeInTheDocument();
  });

  it("opens the Clients submenu when Generated Links is active", () => {
    usePathnameMock.mockReturnValue("/clients/intake-links");
    render(<Navigation canManageTeam={false} canManageFinance={false} />);

    expect(screen.getByRole("button", { name: "Collapse Clients submenu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Generated Links" })).toHaveAttribute("aria-current", "page");
  });

  it("does not expose Settings to an Admin Assistant", () => {
    render(<Navigation canManageTeam={false} canManageFinance={false} />);
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /finance/i })).not.toBeInTheDocument();
  });
});
