"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ConfirmDialog, ConfirmDialogVariant } from "@/components/ui/confirm-dialog";

export interface AlertOptions {
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  variant?: ConfirmDialogVariant;
}

export interface ConfirmOptions extends AlertOptions {
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertContextValue {
  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function WebAlertProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: React.ReactNode;
    confirmText: string;
    cancelText?: string;
    variant: ConfirmDialogVariant;
    isAlertOnly: boolean;
    resolve: (result: boolean) => void;
  } | null>(null);

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || "OK",
        variant: options.variant || "info",
        isAlertOnly: true,
        resolve: () => resolve(),
      });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "destructive",
        isAlertOnly: false,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((confirmed: boolean) => {
    if (dialogState) {
      dialogState.resolve(confirmed);
    }
    setDialogState(null);
  }, [dialogState]);

  const value = useMemo(
    () => ({
      showAlert,
      showConfirm,
    }),
    [showAlert, showConfirm]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      {dialogState && (
        <ConfirmDialog
          open={dialogState.open}
          onOpenChange={(open) => {
            if (!open) handleClose(false);
          }}
          title={dialogState.title}
          description={dialogState.description}
          confirmText={dialogState.confirmText}
          cancelText={dialogState.isAlertOnly ? undefined : dialogState.cancelText}
          variant={dialogState.variant}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useWebAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useWebAlert must be used within a WebAlertProvider");
  }
  return context;
}
