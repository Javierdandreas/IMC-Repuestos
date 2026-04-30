import { useEffect } from "react";

export function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const mainContent = document.getElementById("main-content-area");
    let originalMainOverflow = "";
    if (mainContent) {
      originalMainOverflow = mainContent.style.overflow;
      mainContent.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (mainContent) {
        mainContent.style.overflow = originalMainOverflow;
      }
    };
  }, [lock]);
}
