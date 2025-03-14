import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: boolean;
}

export function ResponsiveContainer({
  children,
  className,
  maxWidth = "xl",
  padding = true,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto",
        {
          "px-4 sm:px-6 md:px-8": padding,
          "max-w-xs": maxWidth === "xs",
          "max-w-sm": maxWidth === "sm",
          "max-w-md": maxWidth === "md",
          "max-w-lg": maxWidth === "lg",
          "max-w-xl": maxWidth === "xl",
          "max-w-2xl": maxWidth === "2xl",
          "max-w-full": maxWidth === "full",
        },
        className
      )}
    >
      {children}
    </div>
  );
}