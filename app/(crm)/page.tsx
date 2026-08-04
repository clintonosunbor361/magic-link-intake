import Link from "next/link";
import { ArrowRight, CircleDashed } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/session";

export default async function OverviewPage() {
  const session = await requireStaffSession();
  return (
    <div>
      <header className="grid gap-8 border-b border-[#d9d8d1] pb-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div><p className="eyebrow">Tuesday operations</p><h1 className="page-title">Good morning, {session.fullName.split(" ")[0]}.</h1><p className="page-description">Your workspace is ready. Operational modules will appear here as each Phase 1 milestone lands.</p></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d9d8d1] bg-white/55 px-4 py-2 text-xs font-semibold text-[#596071]"><span className="h-2 w-2 rounded-full bg-[#93aa53]" />System foundation active</span>
      </header>
      <section className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div><div className="flex items-center justify-between"><h2 className="section-title">Operations queue</h2><span className="font-mono text-xs uppercase tracking-[0.16em] text-[#858a96]">No live records</span></div><div className="mt-4 border-y border-[#d9d8d1] py-14 text-center"><CircleDashed className="mx-auto text-[#858a96]" strokeWidth={1.4} /><h3 className="mt-5 text-lg font-semibold text-[#171b36]">The queue starts with Enquiries</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#707685]">External and internal intake will populate this workspace in the next milestone.</p></div></div>
        <aside className="border-l-0 border-[#d9d8d1] lg:border-l lg:pl-8"><p className="eyebrow">Foundation</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#171b36]">Access is organization-scoped.</h2><p className="mt-4 text-sm leading-6 text-[#707685]">Roles, audit evidence, and protected server boundaries are active before operational data enters the CRM.</p>{session.role === "super_admin" ? <Link href="/settings/team" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#171b36]">Manage team <ArrowRight size={16} /></Link> : null}</aside>
      </section>
    </div>
  );
}
