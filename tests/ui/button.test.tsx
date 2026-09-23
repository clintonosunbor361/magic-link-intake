// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

describe("Button", () => {
  it("uses the standard action size by default", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "min-h-11",
      "rounded-[0.5rem]",
      "font-extrabold",
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

  it("aligns standard buttons with single-line form controls", () => {
    render(
      <>
        <Button>Search</Button>
        <Input aria-label="Search query" />
        <NativeSelect aria-label="Status" defaultValue="active">
          <option value="active">Active</option>
        </NativeSelect>
      </>,
    );

    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("min-h-11");
    expect(screen.getByRole("textbox", { name: "Search query" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Status" })).toHaveClass("min-h-11");
  });
});
