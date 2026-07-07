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
    <div className="flex gap-2">
      <DatePickerPopover
        value={date}
        onChange={(d) => {
          onChangeDate(d);
          if (!d) onChangeTime(null);
        }}
        className="flex-1"
      />
      <TimePickerPopover
        value={time}
        onChange={onChangeTime}
        disabled={!date}
        className="w-28"
      />
    </div>
  );
}
