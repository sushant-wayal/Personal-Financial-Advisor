import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CustomAlertModal } from "../components/CustomAlertModal";

export type AlertType = "info" | "success" | "warning" | "error";

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AlertOptions = {
  title: string;
  message?: string | React.ReactNode;
  type?: AlertType;
  buttons?: AlertButton[];
};

type AlertContextValue = {
  showAlert: (options: AlertOptions) => void;
  showSuccess: (title: string, message?: string | React.ReactNode, onConfirm?: () => void) => void;
  showError: (title: string, message?: string | React.ReactNode, onConfirm?: () => void) => void;
  showWarning: (title: string, message?: string | React.ReactNode, onConfirm?: () => void) => void;
  showInfo: (title: string, message?: string | React.ReactNode, onConfirm?: () => void) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [currentAlert, setCurrentAlert] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const showAlert = useCallback((options: AlertOptions) => {
    setCurrentAlert(options);
    setVisible(true);
  }, []);

  const showSuccess = useCallback((title: string, message?: string | React.ReactNode, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: "success",
      buttons: [{ text: "OK", onPress: onConfirm, style: "default" }],
    });
  }, [showAlert]);

  const showError = useCallback((title: string, message?: string | React.ReactNode, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: "error",
      buttons: [{ text: "OK", onPress: onConfirm, style: "destructive" }],
    });
  }, [showAlert]);

  const showWarning = useCallback((title: string, message?: string | React.ReactNode, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: "warning",
      buttons: [{ text: "OK", onPress: onConfirm, style: "default" }],
    });
  }, [showAlert]);

  const showInfo = useCallback((title: string, message?: string | React.ReactNode, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: "info",
      buttons: [{ text: "OK", onPress: onConfirm, style: "default" }],
    });
  }, [showAlert]);

  const contextValue = useMemo(
    () => ({
      showAlert,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      hideAlert,
    }),
    [showAlert, showSuccess, showError, showWarning, showInfo, hideAlert],
  );

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      {currentAlert ? (
        <CustomAlertModal
          visible={visible}
          title={currentAlert.title}
          message={currentAlert.message}
          type={currentAlert.type || "info"}
          buttons={currentAlert.buttons || [{ text: "OK" }]}
          onDismiss={hideAlert}
        />
      ) : null}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
