"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
    ({ className, children, ...props }, ref) => (
        <CheckboxPrimitive.Root
            ref={ref}
            data-slot="checkbox"
            className={cn(
                "group inline-flex size-4 items-center justify-center rounded-sm border border-border bg-background text-primary shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
                <CheckIcon className="hidden size-3 group-data-[checked]:block" />
                <MinusIcon className="hidden size-3 group-data-[indeterminate]:block" />
            </CheckboxPrimitive.Indicator>
            {children}
        </CheckboxPrimitive.Root>
    )
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
