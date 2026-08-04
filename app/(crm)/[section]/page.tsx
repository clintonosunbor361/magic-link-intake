import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

const sections: Record<string, { title: string; description: string }> = {
  enquiries: { title: "Enquiries", description: "External and internal enquiries will be managed here in Milestone 1." },
  clients: { title: "Clients", description: "Client profiles and order history arrive with the Client and Order milestones." },
  orders: { title: "Orders", description: "Looks, Items, approvals, measurements, and delivery will converge here." },
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
