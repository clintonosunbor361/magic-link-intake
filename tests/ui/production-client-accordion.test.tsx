// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductionClientAccordion } from "@/components/production/client-accordion";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("production client accordion", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("shows summary information and toggles the client details", async () => {
    const user = userEvent.setup();
    render(
      <ProductionClientAccordion
        clientId="client-1"
        clientName="Harrison Babine"
        totalItems={4}
        completedItems={2}
        overdueItems={1}
        defaultOpen={false}
      >
        <p>Production details</p>
      </ProductionClientAccordion>,
    );

    const trigger = screen.getByRole("button", { name: /Harrison Babine/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2 of 4 completed")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Client" })).toHaveAttribute("href", "/clients/client-1");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Production details")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("kuartz-production-client-client-1")).toBe("open");
  });

  it("restores an expanded client during the browser session", async () => {
    window.sessionStorage.setItem("kuartz-production-client-client-2", "open");
    render(
      <ProductionClientAccordion
        clientId="client-2"
        clientName="John Snow"
        totalItems={1}
        completedItems={0}
        overdueItems={0}
        defaultOpen={false}
      >
        <p>Remembered details</p>
      </ProductionClientAccordion>,
    );

    await waitFor(() => expect(screen.getByText("Remembered details")).toBeInTheDocument());
  });
});
