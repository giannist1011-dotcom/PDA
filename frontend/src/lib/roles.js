// Shared role labels & colors for the dynamic-profiles system.

export const ROLE_LABELS = {
  owner: "Ιδιοκτήτης",
  manager: "Υπεύθυνος",
  employee: "Υπάλληλος",
  waiter: "Σερβιτόρος",
};

export const ROLE_COLORS = {
  owner: "#FF6B00",
  manager: "#FFB300",
  employee: "#00B0FF",
  waiter: "#00E676",
};

// Display an audit actor. Legacy orders stored the raw role ("owner"/"employee")
// in the name field — map those to labels; new records carry the profile name.
export const actorLabel = (name, role = null) => {
  if (!name) return "—";
  if (ROLE_LABELS[name]) return ROLE_LABELS[name];
  return role && ROLE_LABELS[role] ? `${name} (${ROLE_LABELS[role]})` : name;
};
