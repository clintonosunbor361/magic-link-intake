import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

const sections: Record<string, { title: string; description: string }> = {
  production: { title: "Production", description: "Vendor assignments, deadlines, briefs, and status tracking are queued for Phase 1." },
  finance: { title: "Finance", description: "Client invoices and Vendor payment positions will be available here." },
  notifications: { title: "Notifications", description: "Deadline and operational reminders will appear here." },
};

export default async function SectionPlaceholder({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();
  return <div><p className="eyebrow">Phase 1 module</p><h1 className="page-title">{content.title}</h1><p className="page-description">{content.description}</p><EmptyState className="mt-10" title="Foundation ready" description="This operational module is scheduled in the Phase 1 backlog." /></div>;
}
