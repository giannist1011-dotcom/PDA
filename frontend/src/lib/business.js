import { Coffee, Hamburger, Pizza, Utensils } from "lucide-react";

// Custom skewer icon (souvlaki) — lucide has no fitting one.
// Vertical stick with meat pieces, drawn in the lucide stroke style.
const SkewerIcon = ({ className, ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 2v2" />
    <rect x="9" y="4" width="6" height="4" rx="1.5" />
    <path d="M12 8v2" />
    <rect x="9" y="10" width="6" height="4" rx="1.5" />
    <path d="M12 14v8" />
  </svg>
);

// Business types with their icon & label — used in registration, header, settings.
export const BUSINESS_TYPES = [
  { key: "souvlaki", label: "Σουβλατζίδικο", icon: SkewerIcon },
  { key: "cafe", label: "Καφετέρια", icon: Coffee },
  { key: "pizzeria", label: "Πιτσαρία", icon: Pizza },
  { key: "burger", label: "Burger", icon: Hamburger },
];

export const businessIcon = (key) =>
  BUSINESS_TYPES.find((b) => b.key === key)?.icon || Utensils;

export const businessLabel = (key) =>
  BUSINESS_TYPES.find((b) => b.key === key)?.label || "";
