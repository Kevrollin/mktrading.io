"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { LOGIN_LINK, PRIMARY_NAV, REGISTER_LINK } from "@/lib/constants";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="ghost" size="icon">
          <Menu aria-hidden="true" className="h-5 w-5" />
          <VisuallyHidden>Open menu</VisuallyHidden>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col gap-6 overflow-y-auto bg-card p-6 shadow-lg outline-none data-[state=open]:animate-slide-in-right">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-foreground">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon">
                <X aria-hidden="true" className="h-5 w-5" />
                <VisuallyHidden>Close menu</VisuallyHidden>
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Site navigation menu</Dialog.Description>

          <nav aria-label="Primary" className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius)] px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Separator />

          <div className="flex flex-col gap-3">
            <Button asChild variant="outline" size="lg" onClick={() => setOpen(false)}>
              <Link href={LOGIN_LINK.href}>{LOGIN_LINK.label}</Link>
            </Button>
            <Button asChild variant="primary" size="lg" onClick={() => setOpen(false)}>
              <Link href={REGISTER_LINK.href}>{REGISTER_LINK.label}</Link>
            </Button>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
