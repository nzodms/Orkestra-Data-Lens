import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-4 md:p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  sub,
}: {
  children: React.ReactNode;
  className?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <h2 className="text-[14.5px] font-semibold tracking-tight">{children}</h2>
      {sub && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{sub}</p>}
    </div>
  );
}
