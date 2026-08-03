"""Ήχοι ειδοποίησης πλατφορμών — παράγονται ΑΠΟ ΤΟΝ SERVER, όχι assets.

ΚΑΝΕΝΑΣ ήχος πλατφόρμας (efood/Box/Wolt) δεν αντιγράφεται: κάθε πλατφόρμα έχει
δικό της, αναγνωρίσιμο μοτίβο από καθαρούς τόνους που συνθέτουμε εδώ σε WAV.
Το αποτέλεσμα cache-άρεται στη μνήμη (μερικά KB ανά πλατφόρμα) και σερβίρεται
από το /platforms/{platform}/sound. Το κατάστημα μπορεί να ανεβάσει δικό του.
"""
import math
import struct

SAMPLE_RATE = 22050
_CACHE: dict[str, bytes] = {}

# (συχνότητα Hz, διάρκεια ms) — 0 Hz = σιωπή. Τρία ξεχωριστά «χαρακτηριστικά»:
# efood = ανοδικό δίτονο ντινγκ, Box = τρία κοφτά χτυπήματα, Wolt = καθοδικό γκονγκ
PATTERNS = {
    "efood": [(880, 130), (0, 55), (1318, 300)],
    "box": [(659, 100), (0, 70), (659, 100), (0, 70), (988, 260)],
    "wolt": [(1046, 170), (0, 40), (784, 420)],
}


def _tone(freq: int, ms: int, out: list) -> None:
    """Ημίτονο με μαλακή αρχή/σβήσιμο (χωρίς κλικ στα άκρα)."""
    n = int(SAMPLE_RATE * ms / 1000)
    fade = max(1, int(n * 0.12))
    for i in range(n):
        if freq <= 0:
            out.append(0.0)
            continue
        env = min(1.0, i / fade, (n - i) / fade)
        # Λίγη 2η αρμονική δίνει «καμπανιστό» χρώμα αντί για στεγνό ημίτονο
        t = i / SAMPLE_RATE
        v = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(4 * math.pi * freq * t)
        out.append(0.55 * env * v)


def _wav_bytes(samples: list) -> bytes:
    pcm = b"".join(
        struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
    )
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
    header += struct.pack("<IHHIIHH", 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
    header += b"data" + struct.pack("<I", len(pcm))
    return header + pcm


def platform_sound_wav(platform: str) -> bytes:
    """Το προεπιλεγμένο WAV της πλατφόρμας (cached στη μνήμη της διεργασίας)."""
    key = platform if platform in PATTERNS else "efood"
    if key not in _CACHE:
        samples: list = []
        # Το μοτίβο παίζει δύο φορές — ακούγεται καθαρά μέσα στον θόρυβο του μαγαζιού
        for _ in range(2):
            for freq, ms in PATTERNS[key]:
                _tone(freq, ms, samples)
            _tone(0, 220, samples)
        _CACHE[key] = _wav_bytes(samples)
    return _CACHE[key]
