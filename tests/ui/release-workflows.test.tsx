// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderWorkspaceNav } from "@/components/orders/order-workspace-nav";
import { OrderLooksFields } from "@/components/orders/order-looks-fields";
import { RefreshWorkspace } from "@/components/app-shell/refresh-workspace";
import { ClientPicker } from "@/components/clients/client-picker";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("release workspace workflows", () => {
  it("exposes active navigation semantically on desktop and mobile", () => {
    render(<OrderWorkspaceNav activeTab="looks" tabs={[{ id: "overview", label: "Overview", href: "/orders/1" }, { id: "looks", label: "Looks & Items", href: "/orders/1?tab=looks" }]} />);
    for (const link of screen.getAllByRole("link", { name: "Looks & Items", hidden: true })) expect(link).toHaveAttribute("aria-current", "page");
  });
  it("removed Looks do not remain in submitted form data", async () => {
    const user = userEvent.setup();
    const { container } = render(<form><OrderLooksFields /></form>);
    await user.type(screen.getByLabelText("Look 1 name"), "Ceremony");
    await user.click(screen.getByRole("button", { name: "Add look" }));
    await user.type(screen.getByLabelText("Look 2 name"), "Removed Look");
    await user.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(new FormData(container.querySelector("form")!).getAll("lookName")).toEqual(["Ceremony"]);
  });
  it("refreshes on request and return to the window", () => {
    render(<RefreshWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("warns about active Orders without blocking selection", () => {
    const { container } = render(<form><ClientPicker required fieldName="clientId" initialSelected={{ id: "client-1", fullName: "Tayo", primaryPhone: "08012345678", email: null, latestOrderTitle: "Wedding", activeOrders: [{ id: "order-1", title: "Wedding" }] }} /></form>);
    expect(screen.getByRole("status")).toHaveTextContent("already has active Orders");
    expect(new FormData(container.querySelector("form")!).get("clientId")).toBe("client-1");
  });
});
