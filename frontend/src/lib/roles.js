// Shared role labels & colors for the dynamic-profiles system.

export const ROLE_LABELS = {
  owner: "Ιδιοκτήτης",
  manager: "Υπεύθυνος",
  employee: "Υπάλληλος",
  waiter: "Σερβιτόρος",
};

export const ROLE_COLORS = {
  owner: "#F97316",
  manager: "#D4A017",
  employee: "#00B0FF",
  waiter: "#00E676",
};

// True when a profile's name is just its role label (e.g. "Υπάλληλος"),
// so UI should show it once instead of "Υπάλληλος · Υπάλληλος".
export const nameMatchesRole = (name, role) =>
  !!name &&
  !!ROLE_LABELS[role] &&
  name.trim().toLowerCase() === ROLE_LABELS[role].toLowerCase();

// Display an audit actor. Legacy orders stored the raw role ("owner"/"employee")
// in the name field — map those to labels; new records carry the profile name.
export const actorLabel = (name, role = null) => {
  if (!name) return "—";
  if (ROLE_LABELS[name]) return ROLE_LABELS[name];
  return role && ROLE_LABELS[role] ? `${name} (${ROLE_LABELS[role]})` : name;
};
