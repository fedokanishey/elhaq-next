"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";

interface BranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string | null) => void;
  isSuperAdmin: boolean;
  getBranchQueryParam: () => string;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  
  // Initialize state from localStorage synchronously
  const getInitialBranchId = () => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("superadmin_selected_branch");
    return saved && saved !== "null" ? saved : null;
  };
  
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(getInitialBranchId);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";

  const setSelectedBranchId = useCallback(
    (branchId: string | null) => {
      setSelectedBranchIdState(branchId);
      // Save to localStorage for persistence
      if (isSuperAdmin) {
        if (branchId) {
          localStorage.setItem("superadmin_selected_branch", branchId);
        } else {
          localStorage.removeItem("superadmin_selected_branch");
        }
      }
    },
    [isSuperAdmin]
  );

  const getBranchQueryParam = useCallback(() => {
    if (isSuperAdmin && selectedBranchId) {
      return `?branchId=${selectedBranchId}`;
    }
    return "";
  }, [isSuperAdmin, selectedBranchId]);

  return (
    <BranchContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        isSuperAdmin,
        getBranchQueryParam,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranchContext must be used within a BranchProvider");
  }
  return context;
}
