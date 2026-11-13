import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-strong",
  secondary: "border border-line bg-surface text-fg shadow-sm hover:bg-surface-2",
  soft: "bg-brand/10 text-brand-text hover:bg-brand/15",
  ghost: "text-muted hover:bg-fg/5 hover:text-fg",
  danger: "bg-danger text-white shadow-sm hover:brightness-95 dark:text-black",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  icon: "h-9 w-9",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
