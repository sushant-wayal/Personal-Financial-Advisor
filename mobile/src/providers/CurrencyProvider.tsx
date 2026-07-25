import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const DEFAULT_CURRENCY_CODE = "INR";

let globalCurrencyCode = DEFAULT_CURRENCY_CODE;

export function normalizeCurrencyCode(value?: string | null) {
    const normalized = (value ?? "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY_CODE;
}

export function setGlobalCurrencyCode(value?: string | null) {
    globalCurrencyCode = normalizeCurrencyCode(value);
}

export function getGlobalCurrencyCode() {
    return globalCurrencyCode;
}

export function getCurrencySymbol(currencyCode = globalCurrencyCode) {
    const normalized = normalizeCurrencyCode(currencyCode);
    if (normalized === "INR") return "₹";
    if (normalized === "USD") return "$";
    if (normalized === "EUR") return "€";
    if (normalized === "GBP") return "£";

    try {
        const part = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: normalized,
            currencyDisplay: "narrowSymbol",
            maximumFractionDigits: 0,
        })
            .formatToParts(0)
            .find((entry) => entry.type === "currency");

        return part?.value ?? normalized;
    } catch {
        return normalized;
    }
}

export function formatIndianNumber(value: number, digits = 0): string {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const fixedStr = absValue.toFixed(digits);
    const parts = fixedStr.split(".");
    let intPart = parts[0];
    const decPart = parts[1];

    let result = intPart;
    if (intPart.length > 3) {
        const lastThree = intPart.substring(intPart.length - 3);
        const otherNumbers = intPart.substring(0, intPart.length - 3);
        result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }

    if (decPart !== undefined) {
        result += "." + decPart;
    }

    return isNegative ? "-" + result : result;
}

export function formatIndianAmountInput(value: string): string {
    const cleanValue = value.replace(/[^0-9.]/g, "");
    if (!cleanValue) return "";
    
    const parts = cleanValue.split(".");
    let intPart = parts[0];
    const decPart = parts.length > 1 ? parts[1] : undefined;

    if (intPart.length > 3) {
        const lastThree = intPart.substring(intPart.length - 3);
        const otherNumbers = intPart.substring(0, intPart.length - 3);
        intPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }

    if (decPart !== undefined) {
        return intPart + "." + decPart;
    }
    return intPart;
}

export function parseIndianAmountInput(value: string): string {
    return value.replace(/,/g, "");
}

export function formatCurrencyAmount(value: number, currencyCode = globalCurrencyCode, digits = 0) {
    const normalized = normalizeCurrencyCode(currencyCode);
    const symbol = getCurrencySymbol(normalized);
    const formattedNum = formatIndianNumber(value, digits);
    
    // Put symbol after negative sign if applicable
    if (formattedNum.startsWith("-")) {
        return `-${symbol}${formattedNum.substring(1)}`;
    }
    return `${symbol}${formattedNum}`;
}

type CurrencyContextValue = {
    currencyCode: string;
    currencySymbol: string;
    setCurrencyCode: (value: string) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

type CurrencyProviderProps = {
    initialCurrencyCode: string;
    children: React.ReactNode;
};

export function CurrencyProvider({ initialCurrencyCode, children }: CurrencyProviderProps) {
    const [currencyCode, setCurrencyCodeState] = useState(() => normalizeCurrencyCode(initialCurrencyCode));

    useEffect(() => {
        setGlobalCurrencyCode(currencyCode);
    }, [currencyCode]);

    const setCurrencyCode = useCallback((value: string) => {
        setCurrencyCodeState(normalizeCurrencyCode(value));
    }, []);

    const value = useMemo(
        () => ({
            currencyCode,
            currencySymbol: getCurrencySymbol(currencyCode),
            setCurrencyCode,
        }),
        [currencyCode, setCurrencyCode],
    );

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    const value = useContext(CurrencyContext);
    if (!value) {
        throw new Error("useCurrency must be used within a CurrencyProvider");
    }
    return value;
}
