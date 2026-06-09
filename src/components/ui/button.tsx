import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-97 cursor-pointer",
          // Variant styles
          variant === 'default' && "bg-primary text-primary-foreground hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95",
          variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-red-500",
          variant === 'outline' && "border border-border bg-transparent hover:bg-secondary hover:text-foreground",
          variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === 'ghost' && "hover:bg-secondary hover:text-foreground",
          variant === 'link' && "text-primary underline-offset-4 hover:underline",
          // Size styles
          size === 'default' && "h-10 px-4 py-2",
          size === 'sm' && "h-9 rounded-md px-3",
          size === 'lg' && "h-11 rounded-md px-8 text-base",
          size === 'icon' && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
