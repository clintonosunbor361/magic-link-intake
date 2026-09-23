// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormModal } from "@/components/ui/form-modal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/order-1",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("FormModal", () => {
  it("opens form content in a body-level dialog and closes it", async () => {
    const user = userEvent.setup();
    render(
      <main data-testid="page-content">
        <FormModal
          title="Add accessory"
          buttonLabel="Add Accessory"
          formId="add-accessory-form"
          submitLabel="Add Accessory"
        >
          <form id="add-accessory-form">
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

    await user.click(screen.getByRole("button", { name: "Close Add accessory" }));
    expect(screen.queryByRole("dialog", { name: "Add accessory" })).not.toBeInTheDocument();
  });

  it("asks before discarding entered information", async () => {
    const user = userEvent.setup();
    render(
      <FormModal
        title="Invite staff"
        buttonLabel="Invite staff"
        formId="invite-form"
        submitLabel="Send invitation"
      >
        <form id="invite-form">
          <input aria-label="Full name" />
        </form>
      </FormModal>,
    );

    await user.click(screen.getByRole("button", { name: "Invite staff" }));
    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Close Invite staff" }));

    expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog", { name: "Invite staff" })).not.toBeInTheDocument();
  });
});
