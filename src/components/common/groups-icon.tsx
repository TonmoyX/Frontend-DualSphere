import type { SVGProps } from "react";

/**
 * Communities icon: a person inside a circle, with shoulders peeking out on both sides so it reads
 * as "a group". Drawn on the same 24×24 grid and stroke as lucide icons, so it matches them in size.
 */
export function GroupsIcon({ strokeWidth = 2, className, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* outer circle */}
      <circle cx="12" cy="12" r="10" />
      {/* main person */}
      <circle cx="12" cy="9" r="2.75" />
      <path d="M7.25 17.75c.6-2.5 2.5-4.1 4.75-4.1s4.15 1.6 4.75 4.1" />
      {/* people on either side */}
      <path d="M7.4 10.9a1.9 1.9 0 0 0-2.9 1.9" />
      <path d="M16.6 10.9a1.9 1.9 0 0 1 2.9 1.9" />
    </svg>
  );
}
