// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VendorRatingForm } from "@/components/vendors/vendor-rating-form";

vi.mock("@/app/actions/vendor-ratings", () => ({
  rateVendorAction: vi.fn(),
}));

const row = {
  assignmentId: "assignment-1",
  vendorId: "vendor-1",
  vendorName: "Eze & Bor",
  lookName: "Traditional Look",
  itemLabel: "Shirt",
  ratingId: null,
  ratingVersion: null,
  quality: null,
  timeliness: null,
  communication: null,
};

describe("VendorRatingForm", () => {
  it("uses a responsive grid that keeps every control inside the form", () => {
    render(<VendorRatingForm orderId="order-1" row={row} />);

    expect(screen.getByTestId("rating-controls")).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-2",
    );
    expect(screen.getByRole("button", { name: "Save rating" })).toHaveClass("w-full");
  });
});
