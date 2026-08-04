// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Navigation } from "@/components/app-shell/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("mobile staff navigation", () => {
  it("opens, closes with Escape, and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    render(<Navigation canManageTeam />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });

    await user.click(trigger);
    expect(screen.getByRole("complementary", { name: "Primary navigation" })).toHaveClass(
      "app-sidebar-open",
    );

    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { name: "Primary navigation" })).not.toHaveClass(
      "app-sidebar-open",
    );
    expect(trigger).toHaveFocus();
  });

  it("does not expose Settings to an Admin Assistant", () => {
    render(<Navigation canManageTeam={false} />);
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });
});
