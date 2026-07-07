// Full menu for "Πεινώκιο" - all prices in EUR
// Sandwich items support customization; double_meat_eligible flag adds +1.50€

export const CATEGORIES = [
  { id: "orektika", name: "Ορεκτικά" },
  { id: "aloifes", name: "Αλοιφές" },
  { id: "temaxia", name: "Τεμάχια" },
  { id: "santouits", name: "Σάντουιτς" },
  { id: "merides", name: "Μερίδες" },
  { id: "anapsyktika", name: "Αναψυκτικά" },
  { id: "mpires", name: "Μπύρες/Ποτά" },
];

export const ORDER_SOURCES = ["Ταμείο", "Τηλέφωνο", "efood", "Box"];

export const BREAD_OPTIONS = ["Πίτα", "Διπλή πίτα", "Ψωμάκι"];
export const EXTRAS_OPTIONS = ["Πατάτα", "Ντομάτα", "Κρεμμύδι", "Κέτσαπ", "Μουστάρδα"];
export const SAUCES_OPTIONS = ["Ουγγαρέζα", "Ρώσικη", "Σως μουστάρδας", "Τζατζίκι", "Τυροκαυτερή"];
export const DOUBLE_MEAT_PRICE = 1.5;

export const MENU_ITEMS = [
  // Ορεκτικά
  { id: "mer-patatas", name: "Μερίδα πατάτας", price: 2.5, category: "orektika" },
  { id: "pita", name: "Πίτα", price: 0.5, category: "orektika" },
  { id: "psomi", name: "Ψωμί", price: 0.5, category: "orektika" },
  // Αλοιφές
  { id: "al-ougarezа", name: "Ουγγαρέζα", price: 0.8, category: "aloifes" },
  { id: "al-rosiki", name: "Ρώσικη", price: 0.8, category: "aloifes" },
  { id: "al-mustard", name: "Σως μουστάρδας", price: 0.8, category: "aloifes" },
  { id: "al-tzatziki", name: "Τζατζίκι", price: 0.8, category: "aloifes" },
  { id: "al-tyrokafteri", name: "Τυροκαυτερή", price: 0.8, category: "aloifes" },
  // Τεμάχια
  { id: "tm-xoirino", name: "Σουβλάκι χοιρινό", price: 1.8, category: "temaxia" },
  { id: "tm-kotopoulo", name: "Σουβλάκι κοτόπουλο", price: 1.8, category: "temaxia" },
  { id: "tm-panseta", name: "Πανσέτα", price: 2.0, category: "temaxia" },
  { id: "tm-soutzoukaki", name: "Σουτζουκάκι", price: 1.8, category: "temaxia" },
  { id: "tm-loukaniko", name: "Λουκάνικο", price: 1.8, category: "temaxia" },
  // Σάντουιτς (customizable)
  {
    id: "sw-xoirino",
    name: "Σουβλάκι χοιρινό",
    price: 3.5,
    category: "santouits",
    customizable: true,
    double_meat_eligible: true,
  },
  {
    id: "sw-kotopoulo",
    name: "Σουβλάκι κοτόπουλο",
    price: 3.5,
    category: "santouits",
    customizable: true,
    double_meat_eligible: true,
  },
  {
    id: "sw-panseta",
    name: "Πανσέτα",
    price: 3.8,
    category: "santouits",
    customizable: true,
    double_meat_eligible: true,
  },
  {
    id: "sw-soutzoukaki",
    name: "Σουτζουκάκι",
    price: 3.5,
    category: "santouits",
    customizable: true,
    double_meat_eligible: false,
  },
  {
    id: "sw-loukaniko",
    name: "Λουκάνικο",
    price: 3.5,
    category: "santouits",
    customizable: true,
    double_meat_eligible: false,
  },
  // Μερίδες
  { id: "mr-xoirino", name: "Σουβλάκι χοιρινό μερίδα", price: 8.5, category: "merides" },
  { id: "mr-kotopoulo", name: "Σουβλάκι κοτόπουλο μερίδα", price: 8.5, category: "merides" },
  { id: "mr-panseta", name: "Πανσέτα μερίδα", price: 9.0, category: "merides" },
  { id: "mr-loukaniko", name: "Λουκάνικο μερίδα", price: 7.5, category: "merides" },
  { id: "mr-soutzoukaki", name: "Σουτζουκάκι μερίδα", price: 8.0, category: "merides" },
  // Αναψυκτικά
  { id: "an-cola-330", name: "Coca-Cola 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-cola-light", name: "Coca-Cola light 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-cola-zero", name: "Coca-Cola zero 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-fanta-orange", name: "Fanta πορτοκάλι 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-fanta-lemon", name: "Fanta λεμονάδα 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-sprite", name: "Sprite 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-sw-soda", name: "Schweppes soda water 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-sw-orange", name: "Schweppes orangeade 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-sw-lemon", name: "Schweppes lemonade 330ml", price: 1.2, category: "anapsyktika" },
  { id: "an-cola-500", name: "Coca-Cola 500ml", price: 1.5, category: "anapsyktika" },
  { id: "an-cola-15", name: "Coca-Cola 1.5lt", price: 2.5, category: "anapsyktika" },
  { id: "an-nero-500", name: "Νερό 500ml", price: 0.5, category: "anapsyktika" },
  { id: "an-nero-15", name: "Νερό 1.5lt", price: 1.0, category: "anapsyktika" },
  // Μπύρες/Ποτά
  { id: "mp-alfa", name: "Άλφα 330ml", price: 1.5, category: "mpires" },
  { id: "mp-fix", name: "Fix 330ml", price: 1.5, category: "mpires" },
  { id: "mp-retsina", name: "Ρετσίνα Μαλαματίνα 500ml", price: 2.5, category: "mpires" },
];
