import React, { createContext, useContext, useMemo, useState } from "react";

type UserProfileContextValue = {
    ownerName: string;
    firstName: string;
    setOwnerName: (value: string) => void;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

function normalizeOwnerName(value?: string | null) {
    return value?.trim() ?? "";
}

export function getFirstName(ownerName?: string | null) {
    const normalized = normalizeOwnerName(ownerName);
    if (!normalized) return "there";
    return normalized.split(/\s+/)[0] || "there";
}

type UserProfileProviderProps = {
    initialOwnerName: string;
    children: React.ReactNode;
};

export function UserProfileProvider({ initialOwnerName, children }: UserProfileProviderProps) {
    const [ownerName, setOwnerNameState] = useState(() => normalizeOwnerName(initialOwnerName));

    const value = useMemo(
        () => ({
            ownerName,
            firstName: getFirstName(ownerName),
            setOwnerName: (value: string) => setOwnerNameState(normalizeOwnerName(value)),
        }),
        [ownerName],
    );

    return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
    const value = useContext(UserProfileContext);
    if (!value) {
        throw new Error("useUserProfile must be used within a UserProfileProvider");
    }
    return value;
}