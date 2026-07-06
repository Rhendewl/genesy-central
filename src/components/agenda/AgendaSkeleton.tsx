"use client";

const columnsStyle = { gridTemplateColumns: "repeat(7, minmax(0, 1fr))" };

export function AgendaSkeleton() {
  return (
    <>
      {/* Desktop: 4x7 grid, same stretch behavior as the real grid — no layout shift */}
      <div className="hidden h-full min-h-0 flex-col px-3 py-2 md:flex">
        <div className="mb-2 grid flex-shrink-0 gap-2" style={columnsStyle}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="mx-auto h-2.5 w-6 rounded-full" style={{ background: "var(--shimmer-light)" }} />
          ))}
        </div>
        <div
          className="grid min-h-0 flex-1 gap-2"
          style={{ ...columnsStyle, gridTemplateRows: "repeat(4, minmax(0, 1fr))" }}
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg"
              style={{ background: "var(--shimmer-base)" }}
            />
          ))}
        </div>
      </div>

      {/* Mobile: single carousel card skeleton */}
      <div className="md:hidden">
        <div className="animate-pulse rounded-2xl" style={{ height: 220, background: "var(--shimmer-base)" }} />
      </div>
    </>
  );
}
