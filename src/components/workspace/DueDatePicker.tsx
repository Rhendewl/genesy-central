"use client";

import { DatePickerPopover } from "./DatePickerPopover";
import { TimePickerPopover } from "./TimePickerPopover";

interface DueDatePickerProps {
  date:         string | null;
  time:         string | null;
  onChangeDate: (date: string | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function DueDatePicker({ date, time, onChangeDate, onChangeTime }: DueDatePickerProps) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <DatePickerPopover
        value={date}
        onChange={(d) => {
          onChangeDate(d);
          if (!d) onChangeTime(null);
        }}
        className="min-w-0"
      />
      <TimePickerPopover
        value={time}
        onChange={onChangeTime}
        disabled={!date}
        className="min-w-0"
      />
    </div>
  );
}
