# OrderDeck Print Bridge

Tray εφαρμογή Windows για καταστήματα που δουλεύουν από tablet/iPad/κινητό:
τρέχει στο PC όπου είναι συνδεδεμένος ο θερμικός εκτυπωτής (π.χ. HPRT TP80N 80mm),
κάνει poll στο backend του OrderDeck και τυπώνει raw ESC/POS τα print_jobs του
καταστήματος. Ενεργοποιείται όταν το κατάστημα επιλέξει «Print Bridge» στις
Ρυθμίσεις → Εκτύπωση.

## Ρύθμιση καταστήματος (web app)

1. Ρυθμίσεις → Λοιπά → Εκτύπωση → Τρόπος εκτύπωσης: **Print Bridge**
2. «Δημιουργία token» → αντιγραφή του token

## Εγκατάσταση στο PC του εκτυπωτή

1. Τρέξτε το `OrderDeckPrintBridge.exe` (ή `python bridge_app.py` για dev)
2. Δεξί κλικ στο εικονίδιο στο tray → **Ρυθμίσεις…**
   - Backend URL: το URL του backend (π.χ. `https://<το-backend>.onrender.com`)
   - Bridge token: επικόλληση από το βήμα 2 παραπάνω
   - Εκτυπωτής: επιλογή του θερμικού από τη λίστα
   - ✔ Εκκίνηση μαζί με τα Windows
3. «Δοκιμαστική εκτύπωση» — πρέπει να βγει καθαρό ticket ΚΑΙ με ελληνικά.
   Αν τα ελληνικά βγουν σύμβολα: δοκιμάστε codepage `n=90` + encoding `cp1253`
   (προεπιλογή: `n=14` + `cp737` για HPRT).

Η κατάσταση φαίνεται στο μενού του tray («Συνδεδεμένο (όνομα μαγαζιού)» /
σφάλμα)· log στο `%APPDATA%\OrderDeckPrintBridge\bridge.log`.

## Build .exe

Σε μηχάνημα με Python 3.10+:

```
cd bridge
build.bat
```

Παράγει το `dist\OrderDeckPrintBridge.exe` (onefile, χωρίς κονσόλα).

## Τεχνικά

- Poll: `GET /api/print/bridge/jobs` κάθε 3" με header `X-Bridge-Token`
  (το token δημιουργείται στις Ρυθμίσεις του μαγαζιού — multi-tenant isolation
  στο backend, `routers/print_jobs.py`).
- Κάθε job έχει `texts[]` — κάθε text = ένα φυσικό ticket· τυπώνεται με
  ESC @ + ESC t (codepage) + κείμενο + feed + partial cut (GS V B 0).
- Ack: `POST /api/print/bridge/jobs/{id}/ack` με `printed`/`failed` (+ error).
- Config: `%APPDATA%\OrderDeckPrintBridge\config.json`.
- Auto-start: κλειδί μητρώου HKCU `...\CurrentVersion\Run`.
