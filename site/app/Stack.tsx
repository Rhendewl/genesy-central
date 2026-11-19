"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./Stack.css";

type StackProps = {
  cards: ReactNode[];
  visible?: number;
  spread?: number;
  depth?: number;
  radius?: number;
  sendToBackOnClick?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
  onChange?: (index: number) => void;
};

export default function Stack({
  cards,
  visible = 5,
  spread = 0.72,
  depth = 0.5,
  radius = 24,
  sendToBackOnClick = true,
  autoplay = true,
  autoplayDelay = 3200,
  pauseOnHover = true,
  className = "",
  style,
  onChange,
}: StackProps) {
  const [order, setOrder] = useState(() => cards.map((_, index) => index));
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  const sendToBack = () => {
    setOrder((current) => {
      if (current.length < 2) return current;
      const next = [...current.slice(1), current[0]];
      onChange?.(next[0]);
      return next;
    });
  };

  useEffect(() => {
    if (!autoplay || cards.length < 2 || (pauseOnHover && hovered)) return;
    const timer = window.setTimeout(sendToBack, autoplayDelay);
    return () => window.clearTimeout(timer);
  }, [autoplay, autoplayDelay, cards.length, hovered, order, pauseOnHover]);

  return (
    <div
      className={`stack ${className}`.trim()}
      style={style}
      role="group"
      aria-label="Resultados de clientes Genesy"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {cards.map((card, index) => {
        const position = order.indexOf(index);
        const shown = position >= 0 && position < visible;
        const isTop = position === 0;
        const rotation = position * spread * 3.7;
        const x = position * spread * 12;
        const y = position * spread * 9;
        const scale = 1 - position * depth * 0.035;

        return (
          <motion.div
            key={index}
            className="stack-card"
            aria-hidden={!isTop}
            animate={{
              x: shown ? x : 36,
              y: shown ? y : 28,
              rotate: shown ? rotation : 10,
              scale: shown ? scale : 0.86,
              opacity: shown ? 1 : 0,
            }}
            transition={
              reduceMotion
                ? { duration: 0.18 }
                : { type: "spring", stiffness: 250, damping: 29, mass: 0.85 }
            }
            style={{ zIndex: cards.length - position, pointerEvents: isTop ? "auto" : "none" }}
            drag={isTop && !reduceMotion}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.72}
            whileDrag={{ scale: 1.025, cursor: "grabbing" }}
            onDragEnd={(_, info) => {
              if (Math.hypot(info.offset.x, info.offset.y) > 70 || Math.hypot(info.velocity.x, info.velocity.y) > 600) {
                sendToBack();
              }
            }}
            onTap={() => {
              if (sendToBackOnClick) sendToBack();
            }}
          >
            <div className="stack-card-face" style={{ borderRadius: radius }}>
              {card}
              {position > 0 && <span className="stack-card-shade" style={{ opacity: Math.min(0.34, position * depth * 0.1) }} />}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
