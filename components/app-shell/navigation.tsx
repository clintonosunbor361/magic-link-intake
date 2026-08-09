"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Factory,
  Hammer,
  House,
  Menu,
  MessageSquareText,
  Settings,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string; icon: typeof House; activePrefix?: string };

const navigation: NavItem[] = [
  { href: "/", label: "Overview", icon: House },
  { href: "/enquiries", label: "Enquiries", icon: MessageSquareText },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/orders", label: "Orders", icon: BriefcaseBusiness },
  // Vendors sits between Orders and Production because that is the workflow order: you assign a
  // Vendor, then you track what they are making. It is top-level rather than under Settings because
  // Admin Assistants create and search Vendors, and Settings is Super-Admin-only.
  { href: "/vendors", label: "Vendors", icon: Hammer },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/finance", label: "Finance", icon: WalletCards },
];

export function Navigation({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const links = canManageTeam
    ? [...navigation, { href: "/settings/team", activePrefix: "/settings", label: "Settings", icon: Settings }]
    : navigation;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !asideRef.current) return;
      const focusable = Array.from(asideRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("keydown", containFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("keydown", containFocus);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <Button ref={triggerRef} variant="ghost" className="mobile-menu-button" type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}>
        <Menu size={20} strokeWidth={1.8} />
      </Button>
      {open ? <Button variant="ghost" className="nav-scrim min-h-0 rounded-none p-0" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside ref={asideRef} className={`app-sidebar ${open ? "app-sidebar-open" : ""}`} aria-label="Primary navigation" aria-modal={open || undefined} role={open ? "dialog" : undefined}>
        <div className="flex items-center justify-between px-5 py-5 lg:px-6">
          <Link href="/" onClick={() => setOpen(false)} className="text-[1.05rem] font-black tracking-[-0.045em] text-white">KUARTZ<span className="text-kuartz-lime">.</span></Link>
          <Button ref={closeRef} variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden" type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close navigation"><X size={20} /></Button>
        </div>
        <nav className="mt-7 flex-1 space-y-1 px-3">
          {links.map(({ href, label, icon: Icon, activePrefix }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(activePrefix ?? href);
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link ${active ? "nav-link-active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link href="/notifications" aria-current={pathname.startsWith("/notifications") ? "page" : undefined} className={`nav-link ${pathname.startsWith("/notifications") ? "nav-link-active" : ""}`} onClick={() => setOpen(false)}><Bell size={18} strokeWidth={1.8} /><span>Notifications</span></Link>
        </div>
      </aside>
    </>
  );
}
