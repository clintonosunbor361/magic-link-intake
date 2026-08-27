// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeasurementDrawer } from "@/components/clients/measurement-drawer";

vi.mock("@/app/actions/measurement-profiles", () => ({
  setMeasurementValuesAction: vi.fn(),
}));

describe("MeasurementDrawer", () => {
  it("edits populated Client measurements from an Order and returns to its Measurements tab", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MeasurementDrawer
        clientId="client-1"
        orderId="order-1"
        measurementProfileId="profile-1"
        fields={[{ fieldId: "chest", fieldName: "Chest", unit: "cm", value: "102", version: 3 }]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Edit measurements" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Edit measurements" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Chest/ })).toHaveValue("102");
    expect(container.querySelector('input[name="returnToOrderId"]')).toHaveValue("order-1");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Edit measurements" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
