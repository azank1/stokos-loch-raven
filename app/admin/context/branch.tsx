"use client";

import { createContext, useContext, useState } from "react";

export const BRANCHES = [
  { slug: "all", label: "All Branches" },
  { slug: "towson", label: "Towson" },
  { slug: "york", label: "Baltimore — York" },
  { slug: "liberty", label: "Liberty" },
];

type BranchContextType = {
  branch: string;
  setBranch: (slug: string) => void;
  branchLabel: string;
};

const BranchContext = createContext<BranchContextType>({
  branch: "all",
  setBranch: () => {},
  branchLabel: "All Branches",
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branch, setBranch] = useState("all");
  const branchLabel = BRANCHES.find((b) => b.slug === branch)?.label ?? "All Branches";

  return (
    <BranchContext.Provider value={{ branch, setBranch, branchLabel }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useAdminBranch() {
  return useContext(BranchContext);
}
