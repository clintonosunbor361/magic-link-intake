"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  // Starts neutral so server-rendered markup matches the client's first paint
  // (the server doesn't know the visitor's timezone); corrected immediately
  // after mount using the browser's actual local time.
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <>
      {greeting}, {name}.
    </>
  );
}
