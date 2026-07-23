// Πεζά + αφαίρεση τόνων για ελληνικό ταίριασμα χωρίς τόνους ("παιδ" ↔ "Παϊδάκια")
export const normText = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
