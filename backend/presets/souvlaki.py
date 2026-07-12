"""Σουβλατζίδικο — the original Πεινώκιο template (re-uses the legacy seed)."""

from seed_data import DEFAULT_CATEGORIES, DEFAULT_CUSTOMIZATION, DEFAULT_ITEMS

PRESET = {
    "key": "souvlaki",
    "label": "Σουβλατζίδικο",
    "categories": DEFAULT_CATEGORIES,
    "items": DEFAULT_ITEMS,
    "customization": DEFAULT_CUSTOMIZATION,
    "stock_categories": [
        "Κρέατα",
        "Λαχανικά",
        "Αλοιφές/Σως",
        "Ψωμί/Πίτες",
        "Αναψυκτικά/Ποτά",
        "Συσκευασίες",
        "Καθαριστικά",
    ],
}
