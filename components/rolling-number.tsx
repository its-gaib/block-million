"use client";

import { useState, type CSSProperties } from "react";

type Direction = "up" | "down";

type RollingNumberProps = {
  value: string;
  className?: string;
  direction?: Direction;
};

type ReelStyle = CSSProperties & {
  "--rolling-from": string;
  "--rolling-to": string;
};

function Digit({ value, direction }: { value: string; direction: Direction }) {
  const [change, setChange] = useState({
    value,
    previous: value,
    revision: 0,
  });

  // Adjust during render so the previous digit and new prop stay in one frame.
  // This also leaves the initial server/client render completely still.
  if (change.value !== value) {
    setChange({
      value,
      previous: change.value,
      revision: change.revision + 1,
    });
  }

  const digits = [Number(change.previous)];
  const step = direction === "up" ? 1 : -1;
  while (digits[digits.length - 1] !== Number(change.value)) {
    digits.push((digits[digits.length - 1] + step + 10) % 10);
  }
  if (direction === "down") digits.reverse();

  const travel = `${-((digits.length - 1) / digits.length) * 100}%`;
  const style: ReelStyle = {
    "--rolling-from": direction === "up" ? "0%" : travel,
    "--rolling-to": direction === "up" ? travel : "0%",
  };

  return (
    <span className="rolling-number__slot">
      <span
        key={change.revision}
        className={`rolling-number__reel${change.revision ? " rolling-number__reel--changed" : ""}`}
        style={style}
      >
        {digits.map((digit, index) => (
          <span className="rolling-number__digit" key={index}>
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}

/** A tabular numeric readout with one accessible value and decorative reels. */
export function RollingNumber({
  value,
  className,
  direction = "down",
}: RollingNumberProps) {
  // Count digit positions from the right, independently of thousands separators.
  // Thus a carry or a change in string length preserves existing digit reels.
  let place = 0;
  const characters = [...value]
    .reverse()
    .map((character, index) => {
      if (/^[0-9]$/.test(character)) {
        return (
          <Digit key={`digit-${place++}`} value={character} direction={direction} />
        );
      }
      return (
        <span className="rolling-number__separator" key={`separator-${index}`}>
          {character}
        </span>
      );
    })
    .reverse();

  return (
    <span
      className={`rolling-number${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={value}
    >
      <span className="rolling-number__visual" aria-hidden="true">
        {characters}
      </span>
    </span>
  );
}
