"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/upload", label: "Upload Snapshot" },
  { href: "/checklist", label: "Migration Checklist" },
];

export const MainNav = () => {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "hover:text-foreground",
              active ? "text-foreground" : "text-foreground/75"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
