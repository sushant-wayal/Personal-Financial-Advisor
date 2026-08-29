"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmDialogVariant = "destructive" | "warning" | "info" | "success" | "default";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    if (onCancel) onCancel();
    if (onOpenChange) onOpenChange(false);
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return {
          icon: <Trash2 className="h-5 w-5 text-rose-400" />,
          iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
          buttonVariant: "destructive" as const,
        };
      case "warning":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
          iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
          buttonVariant: "default" as const,
        };
      case "success":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
          iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          buttonVariant: "default" as const,
        };
      case "info":
      case "default":
      default:
        return {
          icon: <Info className="h-5 w-5 text-cyan-400" />,
          iconBg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
          buttonVariant: "default" as const,
        };
    }
  };

  const vConfig = getVariantStyles();

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange?.(val)}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-white/10 bg-[#161616] p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", vConfig.iconBg)}>
            {vConfig.icon}
          </div>
          <div className="flex-1 space-y-1.5 pt-0.5">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold text-white tracking-normal font-sans">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                {description}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-row justify-end gap-3 pt-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={vConfig.buttonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "rounded-xl font-medium shadow-md",
              variant === "destructive" && "bg-rose-500 text-white hover:bg-rose-600",
              variant === "success" && "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
              variant === "info" && "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            )}
          >
            {isLoading ? "Please wait..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
