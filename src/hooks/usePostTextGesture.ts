"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** Select on press; edit only after two completed taps, never after a drag. */
export function usePostTextGesture(enabled: boolean, onSelect?: () => void, onEdit?: () => void, selected = true) {
  const press = useRef<{ id: number; x: number; y: number; at: number; moved: boolean; type: string } | null>(null);
  const lastTap = useRef<{ x: number; y: number; at: number; type: string } | null>(null);

  useEffect(() => {
    lastTap.current = null;
  }, [enabled, selected]);

  const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const action = target.closest("[data-text-action], [data-text-copy-action], [data-media-action], [data-resize-handle]");
    const handle = target.closest("[data-text-drag-handle], [data-free-drag-handle]");
    if (!enabled || event.button !== 0 || target.closest("[contenteditable='true']") || (action && !handle)) {
      press.current = null;
      lastTap.current = null;
      return;
    }
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), moved: false, type: event.pointerType };
    onSelect?.();
  };

  const onPointerMoveCapture = (event: PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (current?.id === event.pointerId && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) current.moved = true;
  };

  const onPointerUpCapture = (event: PointerEvent<HTMLElement>) => {
    const current = press.current;
    press.current = null;
    if (!enabled || !current || current.id !== event.pointerId) return;
    const now = Date.now();
    if (current.moved || now - current.at > 500 || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
      lastTap.current = null;
      return;
    }
    const previous = lastTap.current;
    if (previous && previous.type === current.type && now - previous.at <= 350 && Math.hypot(current.x - previous.x, current.y - previous.y) <= 24) {
      lastTap.current = null;
      event.preventDefault();
      onEdit?.();
    } else {
      lastTap.current = { x: current.x, y: current.y, at: now, type: current.type };
    }
  };

  const onPointerCancelCapture = () => {
    press.current = null;
    lastTap.current = null;
  };

  return { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture };
}
