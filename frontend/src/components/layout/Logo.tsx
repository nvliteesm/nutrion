import Image from "next/image";
import { cn } from "@/lib/cn";

export function Logo({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  if (markOnly) {
    return (
      <Image
        src="/small-icon.png"
        alt="NutriON"
        width={566}
        height={783}
        className={cn("h-9 w-9 object-contain", className)}
        priority
      />
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/nutrion-logo.png"
        alt="NutriON"
        width={595}
        height={181}
        className="h-8 w-auto object-contain md:h-9"
        priority
      />
    </div>
  );
}
