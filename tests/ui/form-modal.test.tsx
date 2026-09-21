// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FormModal } from "@/components/ui/form-modal";

describe("FormModal", () => {
  it("opens form content in a body-level dialog and closes it", async () => {
    const user = userEvent.setup();
    render(
      <main data-testid="page-content">
        <FormModal title="Add accessory" buttonLabel="Add Accessory">
          <form>
            <input aria-label="Accessory label" />
          </form>
        </FormModal>
      </main>,
    );

    await user.click(screen.getByRole("button", { name: "Add Accessory" }));

    const dialog = screen.getByRole("dialog", { name: "Add accessory" });
    expect(dialog).toHaveClass("form-modal-root");
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByRole("textbox", { name: "Accessory label" })).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Close Add accessory" })[1]);
    expect(screen.queryByRole("dialog", { name: "Add accessory" })).not.toBeInTheDocument();
  });
});
