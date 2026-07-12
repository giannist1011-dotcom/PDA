"""Καφετέρια preset — καφέδες, ροφήματα, χυμοί, σνακ, γλυκά."""

_SUGAR = {
    "id": "sugar",
    "name": "Ζάχαρη",
    "type": "single",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Σκέτος", "price": 0.0},
        {"name": "Μέτριος", "price": 0.0},
        {"name": "Γλυκός", "price": 0.0},
        {"name": "Με ζαχαρίνη", "price": 0.0},
    ],
}

_MILK = {
    "id": "milk",
    "name": "Γάλα",
    "type": "single",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Χωρίς γάλα", "price": 0.0},
        {"name": "Πλήρες", "price": 0.0},
        {"name": "Light", "price": 0.0},
        {"name": "Αμυγδάλου", "price": 0.3},
        {"name": "Βρώμης", "price": 0.3},
    ],
}

_TOST_EXTRAS = {
    "id": "tost-extras",
    "name": "Έξτρα υλικά",
    "type": "multi",
    "required": False,
    "price_mode": "add",
    "options": [
        {"name": "Ντομάτα", "price": 0.3},
        {"name": "Έξτρα τυρί", "price": 0.5},
        {"name": "Γαλοπούλα αντί ζαμπόν", "price": 0.3},
    ],
}


def _coffee(name, price, category="kafedes", milk=False):
    groups = [_SUGAR] + ([_MILK] if milk else [])
    return {
        "name": name,
        "price": price,
        "category": category,
        "option_groups": groups,
    }


PRESET = {
    "key": "cafe",
    "label": "Καφετέρια",
    "categories": [
        {"id": "kafedes", "name": "Καφέδες", "order": 0},
        {"id": "rofimata", "name": "Ροφήματα", "order": 1},
        {"id": "xymoi", "name": "Χυμοί", "order": 2},
        {"id": "snak", "name": "Σνακ/Τοστ", "order": 3},
        {"id": "glyka", "name": "Γλυκά", "order": 4},
    ],
    "items": [
        # Καφέδες
        _coffee("Εσπρέσο", 2.0),
        _coffee("Εσπρέσο διπλός", 2.5),
        _coffee("Καπουτσίνο", 3.0, milk=True),
        _coffee("Φρέντο εσπρέσο", 3.0),
        _coffee("Φρέντο καπουτσίνο", 3.5, milk=True),
        _coffee("Φραπέ", 2.5, milk=True),
        _coffee("Ελληνικός", 2.0),
        _coffee("Λάτε", 3.5, milk=True),
        _coffee("Ice λάτε", 3.8, milk=True),
        # Ροφήματα
        {"name": "Σοκολάτα", "price": 3.5, "category": "rofimata", "option_groups": [_MILK]},
        {"name": "Σοκολάτα βιενουά", "price": 4.0, "category": "rofimata", "option_groups": [_MILK]},
        {"name": "Τσάι (διάφορες γεύσεις)", "price": 2.5, "category": "rofimata"},
        {"name": "Χαμομήλι", "price": 2.5, "category": "rofimata"},
        # Χυμοί
        {"name": "Φρέσκος χυμός πορτοκάλι", "price": 3.0, "category": "xymoi"},
        {"name": "Ανάμεικτος χυμός", "price": 3.5, "category": "xymoi"},
        {"name": "Smoothie φράουλα-μπανάνα", "price": 4.0, "category": "xymoi"},
        {"name": "Εμφιαλωμένο νερό 500ml", "price": 0.5, "category": "xymoi"},
        # Σνακ/Τοστ
        {"name": "Τοστ ζαμπόν-τυρί", "price": 2.5, "category": "snak", "option_groups": [_TOST_EXTRAS]},
        {"name": "Τοστ γαλοπούλα-τυρί", "price": 2.8, "category": "snak", "option_groups": [_TOST_EXTRAS]},
        {"name": "Σάντουιτς κοτόπουλο", "price": 4.0, "category": "snak"},
        {"name": "Κρουασάν βουτύρου", "price": 2.0, "category": "snak"},
        {"name": "Κουλούρι Θεσσαλονίκης", "price": 0.8, "category": "snak"},
        # Γλυκά
        {"name": "Μηλόπιτα", "price": 3.5, "category": "glyka"},
        {"name": "Cheesecake", "price": 4.0, "category": "glyka"},
        {"name": "Σοκολατόπιτα", "price": 4.0, "category": "glyka"},
        {"name": "Μπισκότο cookies", "price": 1.5, "category": "glyka"},
    ],
    "customization": {
        "bread_options": [],
        "extras_options": [],
        "sauces_options": [],
        "double_meat_price": 0.0,
    },
    "stock_categories": [
        "Καφές",
        "Γάλα",
        "Σιρόπια/Γεύσεις",
        "Αναλώσιμα (ποτήρια/καλαμάκια)",
        "Σνακ/Τοστ",
        "Γλυκά",
        "Καθαριστικά",
    ],
}
