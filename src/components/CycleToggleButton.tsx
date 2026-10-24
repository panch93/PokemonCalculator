"use client";

type Props = {
  label: string;
  value: string;
  onClick: () => void;
  className?: string;
};

/** Shared accessible presentation for compact controls that cycle through a few filter states. */
export default function CycleToggleButton({ label, value, onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      className={className}
      aria-label={`${label}: ${value}. Change`}
      aria-pressed="true"
      onClick={onClick}
    >
      {label}: {value} · Change
    </button>
  );
}
