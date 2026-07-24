"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?\])}]$/;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

function splitTrailingPunctuation(value: string) {
  let url = value;
  let trailing = "";

  while (url && TRAILING_PUNCTUATION.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts = text.split(URL_PATTERN);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) => {
        if (!part || !/^(https?:\/\/|www\.)/i.test(part)) {
          return <Fragment key={index}>{part}</Fragment>;
        }

        const { url, trailing } = splitTrailingPunctuation(part);
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

        return (
          <Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto relative z-20 font-medium text-[var(--accent-blue)] underline decoration-current/45 underline-offset-2 hover:decoration-current focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={(event) => event.stopPropagation()}
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </span>
  );
}
