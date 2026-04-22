"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { ProductMeta } from "@/lib/productos-meta";

interface MetadataContextType extends ProductMeta {
  refresh: () => Promise<void>;
}

const MetadataContext = createContext<MetadataContextType | null>(null);

export function MetadataProvider({ children, initialMeta }: { children: ReactNode; initialMeta: ProductMeta }) {
  const [meta, setMeta] = useState<ProductMeta>(initialMeta);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/metadata");
      if (res.ok) {
        const newData = await res.json();
        setMeta(newData);
      }
    } catch (error) {
      console.error("Error refreshing metadata:", error);
    }
  }, []);

  return (
    <MetadataContext.Provider value={{ ...meta, refresh }}>
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
