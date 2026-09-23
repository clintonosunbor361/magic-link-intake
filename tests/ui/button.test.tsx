// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("uses the standard action size by default", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "min-h-10",
      "rounded-[0.5rem]",
      "font-semibold",
    );
  });

  it("supports compact contextual and large page actions", () => {
    render(
      <>
        <Button size="sm">Edit</Button>
        <Button size="lg">Add Client</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass("min-h-9");
    expect(screen.getByRole("button", { name: "Add Client" })).toHaveClass("min-h-11");
  });

  it("provides a consistent destructive treatment", () => {
    render(<Button variant="danger">Archive</Button>);

    expect(screen.getByRole("button", { name: "Archive" })).toHaveClass(
      "border-[#e2b5b2]",
      "bg-[#fff4f3]",
      "text-[#7e403d]",
    );
  });

  it("supports the dark action treatment used on overview cards", () => {
    render(<Button variant="ink">Open work</Button>);

    expect(screen.getByRole("button", { name: "Open work" })).toHaveClass(
      "border-kuartz-ink",
      "bg-kuartz-ink",
      "text-white",
    );
  });
});
