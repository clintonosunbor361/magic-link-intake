import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendDeadlineEmail } from "@/lib/email/resend";
const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
const input = { to: "staff@example.test", staffName: "<Staff>", title: "A deadline", body: 'Client <script>alert("x")</script> & deadline', url: "https://example.test/notifications?a=1&b=2", idempotencyKey: "notification/test" };

describe("notification email", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Kuartz <mail@example.test>");
    send.mockReset().mockResolvedValue({ data: { id: "provider-id" }, error: null });
  });
  it("escapes dynamic HTML, includes plain text, and forwards provider idempotency", async () => {
    expect(await sendDeadlineEmail(input)).toEqual({ id: "provider-id" });
    const [message, options] = send.mock.calls[0];
    expect(message.html).toContain("&lt;Staff&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.text).toContain(input.body);
    expect(options.idempotencyKey).toBe(input.idempotencyKey);
  });
  it.each([[429, true], [500, false], [409, false], [null, false]])("classifies status %s without treating an uncertain send as rejected", async (statusCode, retrySafe) => {
    send.mockResolvedValue({ data: null, error: { statusCode, name: "delivery_error" } });
    await expect(sendDeadlineEmail(input)).rejects.toMatchObject({ retrySafe });
  });
  it("fails visibly when email configuration is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendDeadlineEmail(input)).rejects.toMatchObject({ retrySafe: true });
    expect(send).not.toHaveBeenCalled();
  });
});
