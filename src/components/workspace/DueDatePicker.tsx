"use client";

import { Input } from "@/components/ui/input";

interface DueDatePickerProps {
  date:         string | null;
  time:         string | null;
  onChangeDate: (date: string | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function DueDatePicker({ date, time, onChangeDate, onChangeTime }: DueDatePickerProps) {
  return (
    <div className="flex gap-2">
      <Input
        type="date"
        value={date ?? ""}
        onChange={(e) => onChangeDate(e.target.value || null)}
        className="flex-1"
      />
      <Input
        type="time"
        value={time ?? ""}
        onChange={(e) => onChangeTime(e.target.value || null)}
        disabled={!date}
        className="w-28"
      />
    </div>
  );
}
