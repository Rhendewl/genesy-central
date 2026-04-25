import { useEffect } from "react";
import { useGlobalStore } from "@/store";

/**
 * Registers a modal as open/closed in the global store so the Dock
 * can hide itself while any modal is active.
 *
 * Usage in always-mounted modals (isOpen prop):
 *   useModalOpen(isOpen)
 *
 * Usage in conditionally-rendered modals (component mounts = open):
 *   useModalOpen(true)
 */
export function useModalOpen(isOpen: boolean) {
  const openModal = useGlobalStore((s) => s.openModal);
  const closeModal = useGlobalStore((s) => s.closeModal);

  useEffect(() => {
    if (!isOpen) return;
    openModal();
    return () => closeModal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
