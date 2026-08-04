import { AuthFrame } from "@/components/auth/auth-frame";

export default function OfflinePage() {
  return (
    <AuthFrame eyebrow="Connection required" title="Kuartz is offline" description="Phase 1 keeps operational records on the server and does not sync edits offline.">
      <div className="border-l-2 border-[#d2ff67] bg-white/70 p-5 text-sm leading-7 text-[#50586c]">
        Reconnect to continue. Any form that was open should be reviewed before you submit it again.
      </div>
    </AuthFrame>
  );
}
