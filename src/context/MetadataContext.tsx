"use client";

import { createContext, useContext, ReactNode } from "react";
import { ProductMeta } from "@/lib/productos-meta";

const MetadataContext = createContext<ProductMeta | null>(null);

export function MetadataProvider({ children, initialMeta }: { children: ReactNode; initialMeta: ProductMeta }) {
  return (
    <MetadataContext.Provider value={initialMeta}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error("useMetadata must be used within a MetadataProvider");
  }
  return context;
}
