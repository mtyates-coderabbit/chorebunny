"use client";

import { useEffect, useState } from "react";
import { useSettings, useSettingsMutation } from "@/hooks/useSettings";

type ReminderField = "morning_reminder_time" | "evening_reminder_time";

/** Parent admin section for setting (or clearing) the daily push-reminder time for each routine. */
export function ReminderSettings() {
  const { data: settings, isLoading } = useSettings();
  const update = useSettingsMutation();

  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");

  useEffect(() => {
    if (settings) {
      setMorning(settings.morning_reminder_time ?? "");
      setEvening(settings.evening_reminder_time ?? "");
    }
  }, [settings]);

  if (isLoading) return null;

  const save = (field: ReminderField, value: string) => {
    update.mutate({ [field]: value || null });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-6 space-y-4">
      <h2 className="text-xl font-extrabold text-gray-800">🔔 Routine reminders</h2>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label htmlFor="morning-reminder-time" className="block text-sm font-bold text-gray-700 mb-1">
            Morning routine reminder
          </label>
          <div className="flex items-center gap-2">
            <input
              id="morning-reminder-time"
              type="time"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={morning}
              onChange={(e) => {
                setMorning(e.target.value);
                save("morning_reminder_time", e.target.value);
              }}
            />
            {morning && (
              <button
                type="button"
                onClick={() => {
                  setMorning("");
                  save("morning_reminder_time", "");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="evening-reminder-time" className="block text-sm font-bold text-gray-700 mb-1">
            Evening routine reminder
          </label>
          <div className="flex items-center gap-2">
            <input
              id="evening-reminder-time"
              type="time"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={evening}
              onChange={(e) => {
                setEvening(e.target.value);
                save("evening_reminder_time", e.target.value);
              }}
            />
            {evening && (
              <button
                type="button"
                onClick={() => {
                  setEvening("");
                  save("evening_reminder_time", "");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {update.isError && (
          <p role="alert" className="text-sm text-red-500">
            Couldn&apos;t save that change. Try again.
          </p>
        )}
      </div>
    </div>
  );
}
