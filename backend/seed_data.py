"""Default Πεινώκιο menu used for seeding demo account and new signups."""

DEFAULT_CATEGORIES = [
    {"id": "orektika", "name": "Ορεκτικά", "order": 0},
    {"id": "aloifes", "name": "Αλοιφές", "order": 1},
    {"id": "temaxia", "name": "Τεμάχια", "order": 2},
    {"id": "santouits", "name": "Σάντουιτς", "order": 3},
    {"id": "merides", "name": "Μερίδες", "order": 4},
    {"id": "anapsyktika", "name": "Αναψυκτικά", "order": 5},
    {"id": "mpires", "name": "Μπύρες/Ποτά", "order": 6},
]

DEFAULT_CUSTOMIZATION = {
    "bread_options": [
        {"name": "Πίτα", "price": 0.0},
        {"name": "Διπλή πίτα", "price": 0.5},
        {"name": "Ψωμάκι", "price": 0.0},
    ],
    "extras_options": [
        {"name": "Πατάτα", "price": 0.0},
        {"name": "Ντομάτα", "price": 0.0},
        {"name": "Κρεμμύδι", "price": 0.0},
        {"name": "Κέτσαπ", "price": 0.0},
        {"name": "Μουστάρδα", "price": 0.0},
    ],
    "sauces_options": [
        {"name": "Ουγγαρέζα", "price": 0.8},
        {"name": "Ρώσικη", "price": 0.8},
        {"name": "Σως μουστάρδας", "price": 0.8},
        {"name": "Τζατζίκι", "price": 0.8},
        {"name": "Τυροκαυτερή", "price": 0.8},
    ],
    "double_meat_price": 1.5,
}

DEFAULT_ITEMS = [
    # Ορεκτικά
    {"name": "Μερίδα πατάτας", "price": 2.5, "category": "orektika"},
    {"name": "Πίτα", "price": 0.5, "category": "orektika"},
    {"name": "Ψωμί", "price": 0.5, "category": "orektika"},
    # Αλοιφές
    {"name": "Ουγγαρέζα", "price": 0.8, "category": "aloifes"},
    {"name": "Ρώσικη", "price": 0.8, "category": "aloifes"},
    {"name": "Σως μουστάρδας", "price": 0.8, "category": "aloifes"},
    {"name": "Τζατζίκι", "price": 0.8, "category": "aloifes"},
    {"name": "Τυροκαυτερή", "price": 0.8, "category": "aloifes"},
    # Τεμάχια
    {"name": "Σουβλάκι χοιρινό", "price": 1.8, "category": "temaxia"},
    {"name": "Σουβλάκι κοτόπουλο", "price": 1.8, "category": "temaxia"},
    {"name": "Πανσέτα", "price": 2.0, "category": "temaxia"},
    {"name": "Σουτζουκάκι", "price": 1.8, "category": "temaxia"},
    {"name": "Λουκάνικο", "price": 1.8, "category": "temaxia"},
    # Σάντουιτς
    {"name": "Σουβλάκι χοιρινό", "price": 3.5, "category": "santouits",
     "customizable": True, "double_meat_eligible": True},
    {"name": "Σουβλάκι κοτόπουλο", "price": 3.5, "category": "santouits",
     "customizable": True, "double_meat_eligible": True},
    {"name": "Πανσέτα", "price": 3.8, "category": "santouits",
     "customizable": True, "double_meat_eligible": True},
    {"name": "Σουτζουκάκι", "price": 3.5, "category": "santouits",
     "customizable": True, "double_meat_eligible": False},
    {"name": "Λουκάνικο", "price": 3.5, "category": "santouits",
     "customizable": True, "double_meat_eligible": False},
    # Μερίδες
    {"name": "Σουβλάκι χοιρινό μερίδα", "price": 8.5, "category": "merides"},
    {"name": "Σουβλάκι κοτόπουλο μερίδα", "price": 8.5, "category": "merides"},
    {"name": "Πανσέτα μερίδα", "price": 9.0, "category": "merides"},
    {"name": "Λουκάνικο μερίδα", "price": 7.5, "category": "merides"},
    {"name": "Σουτζουκάκι μερίδα", "price": 8.0, "category": "merides"},
    # Αναψυκτικά
    {"name": "Coca-Cola 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Coca-Cola light 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Coca-Cola zero 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Fanta πορτοκάλι 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Fanta λεμονάδα 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Sprite 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Schweppes soda water 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Schweppes orangeade 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Schweppes lemonade 330ml", "price": 1.2, "category": "anapsyktika"},
    {"name": "Coca-Cola 500ml", "price": 1.5, "category": "anapsyktika"},
    {"name": "Coca-Cola 1.5lt", "price": 2.5, "category": "anapsyktika"},
    {"name": "Νερό 500ml", "price": 0.5, "category": "anapsyktika"},
    {"name": "Νερό 1.5lt", "price": 1.0, "category": "anapsyktika"},
    # Μπύρες/Ποτά
    {"name": "Άλφα 330ml", "price": 1.5, "category": "mpires"},
    {"name": "Fix 330ml", "price": 1.5, "category": "mpires"},
    {"name": "Ρετσίνα Μαλαματίνα 500ml", "price": 2.5, "category": "mpires"},
]
