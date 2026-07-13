import { Coffee, Hamburger, Pizza, Utensils } from "lucide-react";
import SouvlakiIcon from "@/components/icons/SouvlakiIcon";

// Business types with their icon & label — used in registration, header, settings.
export const BUSINESS_TYPES = [
  { key: "souvlaki", label: "Σουβλατζίδικο", icon: SouvlakiIcon },
  { key: "cafe", label: "Καφετέρια", icon: Coffee },
  { key: "pizzeria", label: "Πιτσαρία", icon: Pizza },
  { key: "burger", label: "Burger", icon: Hamburger },
];

export const businessIcon = (key) =>
  BUSINESS_TYPES.find((b) => b.key === key)?.icon || Utensils;

export const businessLabel = (key) =>
  BUSINESS_TYPES.find((b) => b.key === key)?.label || "";
