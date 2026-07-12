"""Πιτσαρία preset — πίτσες με μεγέθη (replace pricing), ορεκτικά, σαλάτες."""


def _sizes(atomiki, mesaia, oikogeneiaki):
    return {
        "id": "size",
        "name": "Μέγεθος",
        "type": "single",
        "required": True,
        "price_mode": "replace",  # the chosen size REPLACES the base price
        "options": [
            {"name": "Ατομική", "price": atomiki},
            {"name": "Μεσαία", "price": mesaia},
            {"name": "Οικογενειακή", "price": oikogeneiaki},
        ],
    }


_TOPPINGS = {
    "id": "toppings",
    "name": "Έξτρα υλικά",
    "type": "multi",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Έξτρα τυρί", "price": 1.0},
        {"name": "Μπέικον", "price": 1.0},
        {"name": "Πεπερόνι", "price": 1.0},
        {"name": "Μανιτάρια", "price": 0.8},
        {"name": "Πιπεριά", "price": 0.5},
    ],
}


def _pizza(name, atomiki, mesaia, oikogeneiaki):
    return {
        "name": name,
        "price": atomiki,  # base = ατομική; the size group replaces it
        "category": "pitses",
        "option_groups": [_sizes(atomiki, mesaia, oikogeneiaki), _TOPPINGS],
    }


PRESET = {
    "key": "pizzeria",
    "label": "Πιτσαρία",
    "categories": [
        {"id": "pitses", "name": "Πίτσες", "order": 0},
        {"id": "orektika", "name": "Ορεκτικά", "order": 1},
        {"id": "salates", "name": "Σαλάτες", "order": 2},
        {"id": "anapsyktika", "name": "Αναψυκτικά", "order": 3},
    ],
    "items": [
        _pizza("Μαργαρίτα", 7.5, 10.5, 13.5),
        _pizza("Σπέσιαλ", 8.5, 11.5, 14.5),
        _pizza("Χωριάτικη", 8.5, 11.5, 14.5),
        _pizza("Πεπερόνι", 8.0, 11.0, 14.0),
        _pizza("4 Τυριά", 9.0, 12.0, 15.0),
        _pizza("Καρμπονάρα", 8.5, 11.5, 14.5),
        _pizza("Βετζετέριαν", 8.0, 11.0, 14.0),
        # Ορεκτικά
        {"name": "Πατάτες φούρνου", "price": 3.5, "category": "orektika"},
        {"name": "Σκορδόψωμο", "price": 2.5, "category": "orektika"},
        {"name": "Σκορδόψωμο με τυρί", "price": 3.5, "category": "orektika"},
        {"name": "Κοτομπουκιές", "price": 5.0, "category": "orektika"},
        {"name": "Μοτσαρελίνια", "price": 4.5, "category": "orektika"},
        # Σαλάτες
        {"name": "Χωριάτικη σαλάτα", "price": 5.0, "category": "salates"},
        {"name": "Σαλάτα του Σεφ", "price": 5.5, "category": "salates"},
        {"name": "Σαλάτα Καίσαρα", "price": 6.0, "category": "salates"},
        # Αναψυκτικά
        {"name": "Coca-Cola 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Coca-Cola 1.5lt", "price": 2.5, "category": "anapsyktika"},
        {"name": "Fanta πορτοκάλι 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Sprite 330ml", "price": 1.5, "category": "anapsyktika"},
        {"name": "Νερό 500ml", "price": 0.5, "category": "anapsyktika"},
        {"name": "Νερό 1.5lt", "price": 1.0, "category": "anapsyktika"},
        {"name": "Μπύρα Fix 330ml", "price": 2.0, "category": "anapsyktika"},
    ],
    "customization": {
        "bread_options": [],
        "extras_options": [],
        "sauces_options": [],
        "double_meat_price": 0.0,
    },
    "stock_categories": [
        "Αλεύρι/Ζύμη",
        "Τυριά",
        "Αλλαντικά",
        "Λαχανικά",
        "Σάλτσες",
        "Αναψυκτικά/Ποτά",
        "Συσκευασίες",
    ],
}
