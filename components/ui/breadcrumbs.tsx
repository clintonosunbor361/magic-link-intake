import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="Breadcrumb"><ol className="flex min-h-11 flex-wrap items-center gap-1 text-sm text-kuartz-muted">{items.map((item, index)=><li key={`${item.label}-${index}`} className="flex items-center gap-1">{index ? <ChevronRight size={14} aria-hidden="true" /> : null}{item.href ? <Link href={item.href} className="rounded px-1 py-2 font-semibold text-kuartz-secondary underline-offset-4 hover:text-kuartz-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kuartz-lime">{item.label}</Link> : <span className="px-1 py-2" aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
