"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoneyDraft, formatMoneyInput, parseMoneyInput } from '@/lib/flowPaymentMoney';

type MoneyInputProps = {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

/** Group thousands as the user types; finish with two decimal places on blur. */
export function MoneyInput({ id, value, onChange, disabled, className }: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const displayed = draft ?? formatMoneyInput(value);

  useEffect(() => {
    // Keep partial decimal input (such as "1.500,") while editing, but follow
    // external recalculations from sliders, parcel counts and the property price.
    if (draft !== null && Math.round(parseMoneyInput(draft) * 100) !== Math.round(value * 100)) setDraft(null);
  }, [value, draft]);

  useLayoutEffect(() => {
    if (caret.current === null || !inputRef.current) return;
    const position = caret.current;
    caret.current = null;
    inputRef.current.setSelectionRange(position, position);
  }, [displayed]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      className={className}
      value={displayed}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const raw = event.target.value;
        const formatted = formatMoneyDraft(raw, false);
        const semanticBefore = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/[^\d,]/g, '').length;
        let count = 0;
        let position = 0;
        while (position < formatted.length && count < semanticBefore) {
          if (/[\d,]/.test(formatted[position])) count++;
          position++;
        }
        caret.current = position;
        setDraft(formatted);
        onChange(parseMoneyInput(formatted));
      }}
      onPaste={(event) => {
        event.preventDefault();
        const formatted = formatMoneyDraft(event.clipboardData.getData('text'));
        caret.current = null;
        setDraft(formatted);
        onChange(parseMoneyInput(formatted));
      }}
      onBlur={() => { caret.current = null; setDraft(null); }}
    />
  );
}
