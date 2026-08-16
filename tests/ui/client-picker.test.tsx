// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientPicker } from "@/components/enquiries/client-picker";

describe("ClientPicker", () => {
  it("supports the Client field required by direct Order creation", () => {
    const { container } = render(
      <ClientPicker
        fieldName="clientId"
        noResultsMessage="No matching active Clients."
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search Clients" })).toBeVisible();
    expect(container.querySelector('input[type="hidden"][name="clientId"]')).toHaveValue("");
  });
});
