// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NativeSelect } from "@/components/ui/native-select";

describe("NativeSelect", () => {
  it("portals its open menu above surrounding layout contexts", async () => {
    const user = userEvent.setup();
    render(
      <div className="overflow-hidden">
        <NativeSelect name="status" aria-label="Production status" defaultValue="not-started">
          <option value="not-started">Not Started</option>
          <option value="in-production">In Production</option>
        </NativeSelect>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Production status" }));

    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox).toHaveStyle({ position: "fixed" });

    await user.click(screen.getByRole("option", { name: "In Production" }));
    expect(screen.getByRole("button", { name: "Production status" })).toHaveTextContent("In Production");
    expect(document.querySelector('input[name="status"]')).toHaveValue("in-production");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("submits its form after a different option is selected", async () => {
    const user = userEvent.setup();
    let submittedValue = "";
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submittedValue = String(new FormData(event.currentTarget).get("status"));
        }}
      >
        <NativeSelect name="status" aria-label="Item status" defaultValue="not-started" submitOnChange>
          <option value="not-started">Not Started</option>
          <option value="in-production">In Production</option>
        </NativeSelect>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Item status" }));
    await user.click(screen.getByRole("option", { name: "In Production" }));

    await waitFor(() => expect(submittedValue).toBe("in-production"));
  });
});
