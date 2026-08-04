// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CrmError from "@/app/(crm)/error";
import CrmLoading from "@/app/(crm)/loading";
import { EmptyState } from "@/components/ui/empty-state";

describe("shared CRM states", () => {
  it("explains an empty collection without presenting fake data", () => {
    render(
      <EmptyState
        title="The queue starts with Enquiries"
        description="External and internal intake will populate this workspace."
      />,
    );
    expect(screen.getByRole("status", { name: "The queue starts with Enquiries" })).toBeVisible();
  });

  it("announces the matching skeleton while a workspace loads", () => {
    render(<CrmLoading />);
    expect(screen.getByRole("status", { name: "Loading workspace" })).toBeVisible();
  });

  it("keeps a failed view recoverable", async () => {
    const reset = vi.fn();
    render(<CrmError error={new Error("Unavailable")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
