// The drill-down from the Birth Certificate: a sheet that slides up from the
// bottom on a phone (drag down to close) and in from the side on a computer.
// One decision at a time: the certificate stays the page, details come to you.
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; sub?: ReactNode; children: ReactNode };

export default function DetailSheet({ open, onOpenChange, title, sub, children }: Props) {
  const mobile = useIsMobile();
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-[22px] font-light">{title}</DrawerTitle>
            {sub && <DrawerDescription>{sub}</DrawerDescription>}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-[24px] font-light">{title}</SheetTitle>
          {sub && <SheetDescription>{sub}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
