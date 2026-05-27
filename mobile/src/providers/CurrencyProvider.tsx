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

    try {
        const part = new Intl.NumberFormat("en", {
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

export function formatCurrencyAmount(value: number, currencyCode = globalCurrencyCode, digits = 0) {
    const normalized = normalizeCurrencyCode(currencyCode);

    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: normalized,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);
    } catch {
        const amount = new Intl.NumberFormat("en-US", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);
        return `${getCurrencySymbol(normalized)}${amount}`;
    }
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
