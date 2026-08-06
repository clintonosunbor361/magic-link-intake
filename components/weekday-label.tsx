"use client";

import { useEffect, useState } from "react";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeekdayLabel() {
  // Starts neutral so server-rendered markup matches the client's first paint
  // (the server doesn't know the visitor's timezone); corrected immediately
  // after mount using the browser's actual local date, same as Greeting.
  const [label, setLabel] = useState("Operations");

  useEffect(() => {
    setLabel(`${WEEKDAYS[new Date().getDay()]} operations`);
  }, []);

  return <>{label}</>;
}
