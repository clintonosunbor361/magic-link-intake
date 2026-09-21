// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsNav } from "@/components/settings-nav";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("SettingsNav", () => {
  it("shows grouped Settings tabs and only the active group's sections", () => {
    render(<SettingsNav current="/settings/consultation-note-sources" />);

    expect(screen.getByRole("link", { name: "Workflow" })).toHaveClass("border-kuartz-lime");
    expect(screen.getByRole("link", { name: "Consultation note sources" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Lead sources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Production statuses" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accessory types" })).not.toBeInTheDocument();
  });

  it("does not show a second navigation row for a single-page group", () => {
    render(<SettingsNav current="/settings/log-history" />);

    expect(screen.getByRole("link", { name: "Log history" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("navigation", { name: "Log history settings" })).not.toBeInTheDocument();
  });
});
