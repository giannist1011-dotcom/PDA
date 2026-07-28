# -*- coding: utf-8 -*-
"""OrderDeck Print Bridge — tray εφαρμογή Windows για θερμική εκτύπωση.

Κάνει poll στο backend του OrderDeck με το bridge token του καταστήματος,
παίρνει τα pending print_jobs και τα τυπώνει raw (ESC/POS) στον επιλεγμένο
εκτυπωτή των Windows (π.χ. HPRT TP80N 80mm). Χρήση:

    pip install -r requirements.txt
    python bridge_app.py

Build σε ένα .exe: δες build.bat / README.md.
"""
import json
import os
import sys
import threading
import time
import traceback
from datetime import datetime

import requests
import win32print
from PIL import Image, ImageDraw
import pystray

APP_NAME = "OrderDeck Print Bridge"
APP_DIR = os.path.join(os.environ.get("APPDATA", "."), "OrderDeckPrintBridge")
CONFIG_PATH = os.path.join(APP_DIR, "config.json")
LOG_PATH = os.path.join(APP_DIR, "bridge.log")
POLL_SECONDS = 3

DEFAULT_CONFIG = {
    "backend_url": "https://",   # π.χ. https://orderdeck-backend.onrender.com
    "token": "",                  # bridge token από Ρυθμίσεις → Εκτύπωση → Print Bridge
    "printer_name": "",           # όνομα εκτυπωτή Windows (π.χ. HPRT TP80N)
    "default_copies": 1,          # αντίγραφα στη δοκιμαστική εκτύπωση
    # ESC/POS ελληνικά: codepage του εκτυπωτή + αντίστοιχο python encoding.
    # HPRT TP80N: n=14 → PC737 (Greek). Εναλλακτικά δοκιμάστε 90/cp1253.
    "codepage_n": 14,
    "encoding": "cp737",
}

# ---------------- config / log ----------------

def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        return {**DEFAULT_CONFIG, **cfg}
    except Exception:
        return dict(DEFAULT_CONFIG)


def save_config(cfg):
    os.makedirs(APP_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def log(msg):
    line = f"[{datetime.now().strftime('%d/%m %H:%M:%S')}] {msg}"
    print(line)
    try:
        os.makedirs(APP_DIR, exist_ok=True)
        # απλό rotation: κόψε το log αν ξεπεράσει ~1MB
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > 1_000_000:
            os.remove(LOG_PATH)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ---------------- εκτύπωση ESC/POS ----------------

def escpos_bytes(text, cfg):
    """Μετατροπή κειμένου σε raw ESC/POS bytes: init, codepage, κείμενο, feed, κόψιμο."""
    enc = cfg.get("encoding") or "cp737"
    data = b"\x1b\x40"  # ESC @  — initialize
    data += b"\x1b\x74" + bytes([int(cfg.get("codepage_n") or 14)])  # ESC t n — codepage
    data += text.encode(enc, errors="replace")
    data += b"\n\n\n\n"
    data += b"\x1d\x56\x42\x00"  # GS V B 0 — feed & partial cut
    return data


def raw_print(printer_name, data: bytes):
    h = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(h, 1, ("OrderDeck Receipt", None, "RAW"))
        try:
            win32print.StartPagePrinter(h)
            win32print.WritePrinter(h, data)
            win32print.EndPagePrinter(h)
        finally:
            win32print.EndDocPrinter(h)
    finally:
        win32print.ClosePrinter(h)


def list_printers():
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return [p[2] for p in win32print.EnumPrinters(flags)]


def print_texts(texts, cfg, copies=1):
    printer = cfg.get("printer_name") or win32print.GetDefaultPrinter()
    for _ in range(max(1, int(copies))):
        for t in texts:
            raw_print(printer, escpos_bytes(t, cfg))


TEST_TICKET = (
    "        ORDERDECK PRINT BRIDGE\n"
    "------------------------------------------\n"
    "Δοκιμαστική εκτύπωση\n"
    "Ώρα: {now}\n"
    "Εκτυπωτής: {printer}\n"
    "------------------------------------------\n"
    "Αν διαβάζετε αυτό το κείμενο καθαρά\n"
    "(και τα ελληνικά!), είστε έτοιμοι.\n"
)


# ---------------- polling ----------------

class Bridge:
    def __init__(self):
        self.cfg = load_config()
        self.status = "Εκκίνηση…"
        self.store_name = ""
        self.stop_event = threading.Event()
        self.tray = None

    # -- status helper: ενημερώνει και το tray tooltip
    def set_status(self, s):
        if s != self.status:
            log(f"Κατάσταση: {s}")
        self.status = s
        if self.tray:
            self.tray.title = f"{APP_NAME} — {s}"

    def api(self, path):
        base = (self.cfg.get("backend_url") or "").rstrip("/")
        return f"{base}/api{path}"

    def headers(self):
        return {"X-Bridge-Token": self.cfg.get("token") or ""}

    def poll_once(self):
        cfg = self.cfg
        if not cfg.get("token") or len(cfg.get("backend_url") or "") < 12:
            self.set_status("Χρειάζεται ρύθμιση (URL + token)")
            return
        try:
            r = requests.get(self.api("/print/bridge/jobs"), headers=self.headers(), timeout=10)
        except Exception:
            self.set_status("Χωρίς σύνδεση με το backend")
            return
        if r.status_code == 401:
            self.set_status("Άκυρο token — ελέγξτε τις ρυθμίσεις")
            return
        if r.status_code != 200:
            self.set_status(f"Σφάλμα backend ({r.status_code})")
            return
        data = r.json()
        self.store_name = data.get("store_name") or ""
        jobs = data.get("jobs") or []
        for job in jobs:
            self.handle_job(job)
        suffix = f" ({self.store_name})" if self.store_name else ""
        self.set_status(f"Συνδεδεμένο{suffix}")

    def handle_job(self, job):
        jid = job.get("id")
        try:
            print_texts(job.get("texts") or [], self.cfg)
            self.ack(jid, "printed")
            log(f"Τυπώθηκε job {jid} ({job.get('kind')}, {len(job.get('texts') or [])} ticket)")
        except Exception as e:
            log(f"ΣΦΑΛΜΑ εκτύπωσης job {jid}: {e}")
            self.ack(jid, "failed", str(e))
            self.set_status("Σφάλμα εκτυπωτή — δείτε το log")

    def ack(self, jid, status, error=None):
        try:
            requests.post(
                self.api(f"/print/bridge/jobs/{jid}/ack"),
                headers=self.headers(),
                json={"status": status, "error": error},
                timeout=10,
            )
        except Exception:
            log(f"Αποτυχία ack για job {jid} — θα ξανατυπωθεί στο επόμενο poll")

    def loop(self):
        while not self.stop_event.is_set():
            try:
                self.poll_once()
            except Exception:
                log("Απρόσμενο σφάλμα:\n" + traceback.format_exc())
                self.set_status("Απρόσμενο σφάλμα — δείτε το log")
            self.stop_event.wait(POLL_SECONDS)

    def test_print(self):
        try:
            printer = self.cfg.get("printer_name") or win32print.GetDefaultPrinter()
            ticket = TEST_TICKET.format(now=datetime.now().strftime("%d/%m/%Y %H:%M"), printer=printer)
            print_texts([ticket], self.cfg, copies=self.cfg.get("default_copies") or 1)
            log("Δοκιμαστική εκτύπωση OK")
        except Exception as e:
            log(f"Δοκιμαστική εκτύπωση ΑΠΕΤΥΧΕ: {e}")
            self.set_status("Σφάλμα εκτυπωτή — δείτε το log")


# ---------------- auto-start με τα Windows ----------------

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def exe_path():
    if getattr(sys, "frozen", False):
        return sys.executable
    return f'"{sys.executable}" "{os.path.abspath(__file__)}"'


def autostart_enabled():
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.QueryValueEx(k, APP_NAME)
        return True
    except OSError:
        return False


def set_autostart(enabled):
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        if enabled:
            winreg.SetValueEx(k, APP_NAME, 0, winreg.REG_SZ, exe_path())
        else:
            try:
                winreg.DeleteValue(k, APP_NAME)
            except OSError:
                pass


# ---------------- παράθυρο ρυθμίσεων (tkinter) ----------------

def open_settings(bridge):
    """Ανοίγει το παράθυρο ρυθμίσεων σε δικό του thread (ένα κάθε φορά)."""
    if getattr(open_settings, "_open", False):
        return
    open_settings._open = True

    def run():
        try:
            import tkinter as tk
            from tkinter import ttk, messagebox

            cfg = bridge.cfg
            root = tk.Tk()
            root.title(f"{APP_NAME} — Ρυθμίσεις")
            root.resizable(False, False)
            root.attributes("-topmost", True)
            frm = ttk.Frame(root, padding=14)
            frm.grid()

            def field(row, label):
                ttk.Label(frm, text=label).grid(row=row, column=0, sticky="w", pady=3)
                var = tk.StringVar()
                ttk.Entry(frm, textvariable=var, width=52).grid(row=row, column=1, pady=3, padx=(8, 0))
                return var

            url_var = field(0, "Backend URL:")
            url_var.set(cfg.get("backend_url") or "")
            token_var = field(1, "Bridge token:")
            token_var.set(cfg.get("token") or "")

            ttk.Label(frm, text="Εκτυπωτής:").grid(row=2, column=0, sticky="w", pady=3)
            printer_var = tk.StringVar(value=cfg.get("printer_name") or "")
            try:
                printers = list_printers()
            except Exception:
                printers = []
            ttk.Combobox(frm, textvariable=printer_var, values=printers, width=49).grid(
                row=2, column=1, pady=3, padx=(8, 0)
            )

            copies_var = field(3, "Αντίγραφα δοκιμής:")
            copies_var.set(str(cfg.get("default_copies") or 1))
            cp_var = field(4, "ESC/POS codepage (n):")
            cp_var.set(str(cfg.get("codepage_n") or 14))
            enc_var = field(5, "Encoding κειμένου:")
            enc_var.set(cfg.get("encoding") or "cp737")
            ttk.Label(
                frm,
                text="Ελληνικά: n=14 + cp737 (προεπιλογή)· αν βγουν σύμβολα δοκιμάστε n=90 + cp1253.",
                foreground="#666",
            ).grid(row=6, column=0, columnspan=2, sticky="w", pady=(0, 6))

            auto_var = tk.BooleanVar(value=autostart_enabled())
            ttk.Checkbutton(frm, text="Εκκίνηση μαζί με τα Windows", variable=auto_var).grid(
                row=7, column=0, columnspan=2, sticky="w", pady=3
            )

            def do_save():
                try:
                    cfg["backend_url"] = url_var.get().strip()
                    cfg["token"] = token_var.get().strip()
                    cfg["printer_name"] = printer_var.get().strip()
                    cfg["default_copies"] = max(1, int(copies_var.get() or "1"))
                    cfg["codepage_n"] = int(cp_var.get() or "14")
                    cfg["encoding"] = enc_var.get().strip() or "cp737"
                    save_config(cfg)
                    try:
                        set_autostart(auto_var.get())
                    except Exception as e:
                        messagebox.showwarning(APP_NAME, f"Οι ρυθμίσεις αποθηκεύτηκαν, αλλά το auto-start απέτυχε: {e}")
                    log("Οι ρυθμίσεις αποθηκεύτηκαν")
                    root.destroy()
                except ValueError:
                    messagebox.showerror(APP_NAME, "Μη έγκυρος αριθμός στα πεδία αντιγράφων/codepage")

            def do_test():
                # εφαρμόζουμε τις τιμές της φόρμας πριν τη δοκιμή (χωρίς αποθήκευση)
                cfg["backend_url"] = url_var.get().strip()
                cfg["token"] = token_var.get().strip()
                cfg["printer_name"] = printer_var.get().strip()
                try:
                    cfg["codepage_n"] = int(cp_var.get() or "14")
                except ValueError:
                    cfg["codepage_n"] = 14
                cfg["encoding"] = enc_var.get().strip() or "cp737"
                threading.Thread(target=bridge.test_print, daemon=True).start()

            btns = ttk.Frame(frm)
            btns.grid(row=8, column=0, columnspan=2, pady=(10, 0), sticky="e")
            ttk.Button(btns, text="Δοκιμαστική εκτύπωση", command=do_test).grid(row=0, column=0, padx=4)
            ttk.Button(btns, text="Αποθήκευση", command=do_save).grid(row=0, column=1, padx=4)
            ttk.Button(btns, text="Άκυρο", command=root.destroy).grid(row=0, column=2)

            root.mainloop()
        finally:
            open_settings._open = False

    threading.Thread(target=run, daemon=True).start()


# ---------------- tray ----------------

def tray_icon_image():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 14, 58, 44], radius=6, fill=(224, 82, 62, 255))  # «εκτυπωτής»
    d.rectangle([18, 4, 46, 14], fill=(120, 40, 40, 255))
    d.rectangle([18, 44, 46, 60], fill=(255, 255, 255, 255))
    d.line([22, 50, 42, 50], fill=(60, 60, 60, 255), width=2)
    d.line([22, 55, 38, 55], fill=(60, 60, 60, 255), width=2)
    return img


def main():
    os.makedirs(APP_DIR, exist_ok=True)
    bridge = Bridge()
    log(f"=== Εκκίνηση {APP_NAME} ===")

    poller = threading.Thread(target=bridge.loop, daemon=True)
    poller.start()

    def quit_app(icon, item):
        bridge.stop_event.set()
        icon.stop()

    icon = pystray.Icon(
        APP_NAME,
        tray_icon_image(),
        APP_NAME,
        menu=pystray.Menu(
            pystray.MenuItem(lambda item: f"Κατάσταση: {bridge.status}", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Ρυθμίσεις…", lambda icon, item: open_settings(bridge)),
            pystray.MenuItem(
                "Δοκιμαστική εκτύπωση",
                lambda icon, item: threading.Thread(target=bridge.test_print, daemon=True).start(),
            ),
            pystray.MenuItem("Άνοιγμα log", lambda icon, item: os.startfile(LOG_PATH)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Έξοδος", quit_app),
        ),
    )
    bridge.tray = icon
    icon.run()


if __name__ == "__main__":
    main()
