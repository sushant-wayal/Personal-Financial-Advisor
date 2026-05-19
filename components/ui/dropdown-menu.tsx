"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({
    className,
    side = "bottom",
    align = "end",
    sideOffset = 6,
    alignOffset = 0,
    ...props
}: Menu.Popup.Props &
    Pick<Menu.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">) {
    return (
        <Menu.Portal>
            <Menu.Positioner
                side={side}
                align={align}
                sideOffset={sideOffset}
                alignOffset={alignOffset}
                className="z-50"
            >
                <Menu.Popup
                    data-slot="dropdown-content"
                    className={cn(
                        "min-w-44 rounded-none border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
                        className
                    )}
                    {...props}
                />
            </Menu.Positioner>
        </Menu.Portal>
    );
}

function DropdownMenuLabel({ className, ...props }: Menu.GroupLabel.Props) {
    return (
        <Menu.Group>
            <Menu.GroupLabel
                data-slot="dropdown-label"
                className={cn("px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground", className)}
                {...props}
            />
        </Menu.Group>
    );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
    return (
        <Menu.Separator
            data-slot="dropdown-separator"
            className={cn("my-1 h-px bg-border", className)}
            {...props}
        />
    );
}

function DropdownMenuItem({ className, ...props }: Menu.Item.Props) {
    return (
        <Menu.Item
            data-slot="dropdown-item"
            className={cn(
                "flex cursor-default items-center gap-2 rounded-none px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            {...props}
        />
    );
}

function DropdownMenuCheckboxItem({
    className,
    children,
    ...props
}: Menu.CheckboxItem.Props) {
    return (
        <Menu.CheckboxItem
            data-slot="dropdown-checkbox-item"
            className={cn(
                "flex cursor-default items-center gap-2 rounded-none px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            {...props}
        >
            <Menu.CheckboxItemIndicator className="flex size-4 items-center justify-center">
                <CheckIcon className="size-3" />
            </Menu.CheckboxItemIndicator>
            <span className="flex-1">{children}</span>
        </Menu.CheckboxItem>
    );
}

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
};
