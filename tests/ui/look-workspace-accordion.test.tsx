// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { LookWorkspaceAccordion } from "@/components/orders/look-workspace-accordion";

describe("Look workspace accordion", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("shows the Look summary and reveals its Items", async () => {
    const user = userEvent.setup();
    render(
      <LookWorkspaceAccordion
        orderId="order-1"
        lookId="look-1"
        name="Traditional Look"
        itemCount={2}
        lookDate="2026-09-20"
        archived={false}
        defaultOpen={false}
        lifecycleAction={null}
        addItemForm={<p>New Item form</p>}
      >
        <p>Agbada, Qty 1</p>
      </LookWorkspaceAccordion>,
    );

    const trigger = screen.getByRole("button", { name: /Traditional Look/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2 items")).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Agbada, Qty 1")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("kuartz-order-order-1-look-look-1")).toBe("open");

    await user.click(screen.getByRole("button", { name: "Add Item" }));
    expect(screen.getByText("New Item form")).toBeInTheDocument();
  });

  it("restores the open Look after returning to the page", async () => {
    window.sessionStorage.setItem("kuartz-order-order-2-look-look-2", "open");
    render(
      <LookWorkspaceAccordion
        orderId="order-2"
        lookId="look-2"
        name="Reception Look"
        itemCount={1}
        lookDate={null}
        archived={false}
        defaultOpen={false}
        lifecycleAction={null}
      >
        <p>Remembered Item</p>
      </LookWorkspaceAccordion>,
    );

    await waitFor(() => expect(screen.getByText("Remembered Item")).toBeInTheDocument());
  });

  it("closes the actions menu when the Look is collapsed", async () => {
    const user = userEvent.setup();
    render(
      <LookWorkspaceAccordion
        orderId="order-3"
        lookId="look-3"
        name="Traditional Look"
        itemCount={2}
        lookDate={null}
        archived={false}
        defaultOpen
        lifecycleAction={<button type="button">Archive Look</button>}
      >
        <p>Look Items</p>
      </LookWorkspaceAccordion>,
    );

    const actionsTrigger = screen.getByLabelText("Actions for Traditional Look");
    const actionsMenu = actionsTrigger.closest("details");
    const accordionTrigger = screen.getByRole("button", { name: /Traditional Look/i });

    await user.click(actionsTrigger);
    expect(actionsMenu).toHaveAttribute("open");

    await user.click(accordionTrigger);
    expect(actionsMenu).not.toHaveAttribute("open");
  });

  it("places edit in the Look actions menu and bulk assignment beside Add Item", async () => {
    const user = userEvent.setup();
    render(
      <LookWorkspaceAccordion
        orderId="order-4"
        lookId="look-4"
        name="Evening Look"
        itemCount={2}
        lookDate={null}
        archived={false}
        defaultOpen
        editAction={<button type="button">Edit Look</button>}
        lifecycleAction={null}
        bulkAssignment={<button type="button">Assign Vendor</button>}
        addItemForm={<p>New Item form</p>}
      >
        <p>Look Items</p>
      </LookWorkspaceAccordion>,
    );

    const assignVendor = screen.getByRole("button", { name: "Assign Vendor" });
    const addItem = screen.getByRole("button", { name: "Add Item" });
    expect(assignVendor.parentElement).toBe(addItem.parentElement);

    expect(screen.queryByRole("button", { name: "Edit Look" })).not.toBeVisible();
    await user.click(screen.getByLabelText("Actions for Evening Look"));
    expect(screen.getByRole("button", { name: "Edit Look" })).toBeVisible();
  });
});
