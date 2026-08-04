// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PwaRuntime } from "@/components/pwa-runtime";

describe("PwaRuntime", () => {
  const register = vi.fn();

  beforeEach(() => {
    register.mockReset();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("registers the service worker and explains an offline state", async () => {
    render(<PwaRuntime />);

    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fireEvent(window, new Event("offline"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "You’re offline. Kuartz is unavailable until the connection returns.",
      );
    });
  });
});
