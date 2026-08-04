"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Factory,
  House,
  Link2,
  Menu,
  MessageSquareText,
  Settings,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/", label: "Overview", icon: House },
  { href: "/enquiries", label: "Enquiries", icon: MessageSquareText },
  { href: "/intake-links", label: "Intake links", icon: Link2 },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/orders", label: "Orders", icon: BriefcaseBusiness },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/finance", label: "Finance", icon: WalletCards },
];

export function Navigation({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const links = canManageTeam
    ? [...navigation, { href: "/settings/team", label: "Settings", icon: Settings }]
    : navigation;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <Button ref={triggerRef} variant="ghost" className="mobile-menu-button" type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}>
        <Menu size={20} strokeWidth={1.8} />
      </Button>
      {open ? <Button variant="ghost" className="nav-scrim min-h-0 rounded-none p-0" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside className={`app-sidebar ${open ? "app-sidebar-open" : ""}`} aria-label="Primary navigation">
        <div className="flex items-center justify-between px-5 py-5 lg:px-6">
          <Link href="/" onClick={() => setOpen(false)} className="text-[1.05rem] font-black tracking-[-0.045em] text-white">KUARTZ<span className="text-[#d2ff67]">.</span></Link>
          <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden" type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></Button>
        </div>
        <nav className="mt-7 flex-1 space-y-1 px-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link ${active ? "nav-link-active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link href="/notifications" className="nav-link" onClick={() => setOpen(false)}><Bell size={18} strokeWidth={1.8} /><span>Notifications</span></Link>
        </div>
      </aside>
    </>
  );
}
