"""Burger preset — burgers με έξτρα υλικά & combo, ορεκτικά, σως."""

_EXTRAS = {
    "id": "extras",
    "name": "Έξτρα υλικά",
    "type": "multi",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Μπέικον", "price": 1.0},
        {"name": "Έξτρα τυρί", "price": 0.5},
        {"name": "Αυγό", "price": 1.0},
        {"name": "Καραμελωμένα κρεμμύδια", "price": 0.8},
        {"name": "Μανιτάρια", "price": 0.8},
    ],
}

_COMBO = {
    "id": "combo",
    "name": "Συνοδευτικά",
    "type": "single",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Σκέτο", "price": 0.0},
        {"name": "Combo πατάτες + αναψυκτικό", "price": 3.0},
        {"name": "Μόνο πατάτες", "price": 2.0},
    ],
}


def _burger(name, price):
    return {
        "name": name,
        "price": price,
        "category": "burgers",
        "option_groups": [_EXTRAS, _COMBO],
    }


PRESET = {
    "key": "burger",
    "label": "Burger",
    "categories": [
        {"id": "burgers", "name": "Burgers", "order": 0},
        {"id": "orektika", "name": "Ορεκτικά", "order": 1},
        {"id": "sos", "name": "Σως", "order": 2},
        {"id": "anapsyktika", "name": "Αναψυκτικά", "order": 3},
    ],
    "items": [
        _burger("Classic burger", 6.5),
        _burger("Cheeseburger", 7.0),
        _burger("Bacon burger", 7.5),
        _burger("Double burger", 9.0),
        _burger("Chicken burger", 7.0),
        _burger("Veggie burger", 6.5),
        # Ορεκτικά
        {"name": "Πατάτες τηγανητές", "price": 3.0, "category": "orektika"},
        {"name": "Πατάτες με τυρί & μπέικον", "price": 4.5, "category": "orektika"},
        {"name": "Onion rings", "price": 4.0, "category": "orektika"},
        {"name": "Κοτομπουκιές", "price": 5.0, "category": "orektika"},
        {"name": "Mozzarella sticks", "price": 4.5, "category": "orektika"},
        # Σως
        {"name": "Κέτσαπ", "price": 0.5, "category": "sos"},
        {"name": "Μαγιονέζα", "price": 0.5, "category": "sos"},
        {"name": "BBQ σως", "price": 0.7, "category": "sos"},
        {"name": "Ranch σως", "price": 0.7, "category": "sos"},
        {"name": "Καυτερή σως", "price": 0.7, "category": "sos"},
        # Αναψυκτικά
        {"name": "Coca-Cola 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Coca-Cola zero 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Fanta πορτοκάλι 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Sprite 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Νερό 500ml", "price": 0.5, "category": "anapsyktika"},
        {"name": "Μπύρα Fix 330ml", "price": 2.0, "category": "anapsyktika"},
    ],
    "customization": {
        "bread_options": [],
        "extras_options": [],
        "sauces_options": [],
        "double_meat_price": 0.0,
    },
    "stock_categories": [
        "Κρέατα/Μπιφτέκια",
        "Ψωμάκια",
        "Τυριά/Αλλαντικά",
        "Λαχανικά",
        "Σως",
        "Κατεψυγμένα",
        "Συσκευασίες",
        "Αναψυκτικά",
    ],
}
