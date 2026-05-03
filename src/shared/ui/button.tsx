import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@shared/lib/utils";
import { ChevronRight } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Custom variants for Univ
        hero: "bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full shadow-soft hover:shadow-elevated hover:-translate-y-0.5",
        heroOutline: "border-2 border-primary text-primary bg-transparent rounded-full hover:bg-primary/5",
        pill: "bg-primary text-primary-foreground rounded-full",
        pillOutline: "border-2 border-primary text-primary bg-transparent rounded-full hover:bg-primary/5",
        nav: "text-muted-foreground hover:text-primary bg-transparent",
        navActive: "text-primary bg-transparent font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-5 w-5",
        sm: "h-9 px-3",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

// Special button with icon (matching reference design)
interface ButtonWithIconProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "hero" | "heroOutline" | "ghost";
  size?: "default" | "lg" | "xl";
}

const ButtonWithIcon = React.forwardRef<HTMLButtonElement, ButtonWithIconProps>(
  ({ className, variant = "hero", size = "lg", children, ...props }, ref) => {
    const isOutline = variant === "heroOutline";
    const isGhost = variant === "ghost";

    if (isGhost) {
      return (
        <button
          className={cn(
            "inline-flex items-center gap-2 font-semibold transition-all duration-300 rounded-full text-muted-foreground hover:text-foreground",
            size === "xl" && "px-6 py-4 text-lg",
            size === "lg" && "px-4 py-2.5",
            size === "default" && "px-4 py-2 text-sm",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </button>
      );
    }

    return (
      <button
        className={cn(
          "inline-flex items-center gap-3 font-semibold transition-all duration-300 rounded-full",
          isOutline
            ? "border-2 border-primary text-primary bg-transparent hover:bg-primary/5 px-5 py-3"
            : "bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-3 shadow-soft hover:shadow-elevated hover:-translate-y-0.5",
          size === "xl" && "px-6 py-4 text-lg",
          size === "default" && "px-4 py-2.5 text-sm",
          className
        )}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full",
            isOutline ? "bg-primary text-primary-foreground" : "bg-primary-foreground/20",
            size === "xl" ? "h-9 w-9" : size === "lg" ? "h-8 w-8" : "h-6 w-6"
          )}
        >
          <ChevronRight className={cn(size === "default" ? "h-3 w-3" : "h-4 w-4")} />
          <ChevronRight className={cn(size === "default" ? "h-3 w-3 -ml-1.5" : "h-4 w-4 -ml-2")} />
        </span>
        {children}
      </button>
    );
  }
);
ButtonWithIcon.displayName = "ButtonWithIcon";

export { Button, ButtonWithIcon, buttonVariants };