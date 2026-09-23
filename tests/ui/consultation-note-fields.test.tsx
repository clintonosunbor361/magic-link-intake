// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConsultationNoteFields } from "@/components/orders/consultation-note-fields";

const sources = [
  { id: "generic", name: "Phone call", template: "generic" as const },
  { id: "email", name: "Email", template: "email" as const },
  { id: "reference", name: "WhatsApp", template: "reference" as const },
  { id: "colour", name: "Colour reference", template: "colour" as const },
];

describe("ConsultationNoteFields", () => {
  it("shows the source-specific fields and preserves values across source changes", async () => {
    const user = userEvent.setup();
    render(<ConsultationNoteFields sources={sources} initialSourceId="email" />);

    const subject = screen.getByLabelText(/Subject/);
    await user.type(subject, "Reception suit");
    await user.click(screen.getByRole("button", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "WhatsApp" }));
    expect(screen.queryByLabelText(/Subject/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Reference URL/), "https://example.com/look");
    await user.click(screen.getByRole("button", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "Email" }));
    expect(screen.getByLabelText(/Subject/)).toHaveValue("Reception suit");

    await user.click(screen.getByRole("button", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "Colour reference" }));
    expect(screen.getByLabelText(/Colour name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colour code/)).toBeInTheDocument();
  });
});
