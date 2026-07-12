"""Business-type presets used to seed new accounts at registration."""

from .souvlaki import PRESET as SOUVLAKI
from .cafe import PRESET as CAFE
from .pizzeria import PRESET as PIZZERIA
from .burger import PRESET as BURGER

PRESETS = {p["key"]: p for p in (SOUVLAKI, CAFE, PIZZERIA, BURGER)}

DEFAULT_TABLE_NAMES = [f"Τ{i}" for i in range(1, 9)]

EMPTY_CUSTOMIZATION = {
    "bread_options": [],
    "extras_options": [],
    "sauces_options": [],
    "double_meat_price": 0.0,
}
