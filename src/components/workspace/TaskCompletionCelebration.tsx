"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

export function TaskCompletionCelebration({ celebrationId }: { celebrationId: number | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {celebrationId !== null && (
        <motion.div
          key={celebrationId}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.08 : 0.16 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-[-20%]"
            style={{
              background: "radial-gradient(circle at center, rgba(34,197,94,0.42) 0%, rgba(34,197,94,0.18) 28%, rgba(34,197,94,0.04) 52%, transparent 72%)",
              filter: "blur(32px)",
            }}
            initial={{ scale: reduceMotion ? 1 : 0.45, opacity: 0 }}
            animate={{ scale: reduceMotion ? 1 : [0.45, 1.08, 1], opacity: [0, 1, 0.72] }}
            exit={{ scale: 1.18, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.9, ease: "easeOut" }}
          />

          <motion.div
            className="relative flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "rgba(34,197,94,0.2)",
              border: "1px solid rgba(134,239,172,0.65)",
              boxShadow: "0 0 45px rgba(34,197,94,0.65), 0 0 110px rgba(34,197,94,0.35)",
              backdropFilter: "blur(12px)",
            }}
            initial={{ scale: reduceMotion ? 1 : 0.72, opacity: reduceMotion ? 1 : 0.45 }}
            animate={{ scale: reduceMotion ? 1 : [0.72, 1.12, 1], opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.38, type: reduceMotion ? "tween" : "spring", stiffness: 420, damping: 22 }}
          >
            <Check size={38} color="#dcfce7" strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
