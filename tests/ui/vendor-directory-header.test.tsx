// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VendorDirectoryHeader } from "@/components/vendors/vendor-directory-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/vendors",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("VendorDirectoryHeader", () => {
  it("opens the add vendor form in a body-level modal", async () => {
    const user = userEvent.setup();
    render(
      <main data-testid="page-content">
        <VendorDirectoryHeader>
          <form id="add-vendor-form">
            <input aria-label="Vendor name" />
          </form>
        </VendorDirectoryHeader>
      </main>,
    );

    await user.click(screen.getByRole("button", { name: "Add Vendor" }));

    const dialog = screen.getByRole("dialog", { name: "Add vendor" });
    expect(dialog).toHaveClass("form-modal-root");
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByRole("textbox", { name: "Vendor name" })).toBeVisible();
  });
});
