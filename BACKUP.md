# Backups βάσης δεδομένων (MongoDB Atlas M0)

Το free tier M0 του Atlas δεν έχει ενσωματωμένα backups, οπότε ένα GitHub Actions workflow
(`.github/workflows/backup.yml`) κάνει καθημερινό `mongodump` και το αποθηκεύει ως artifact.

- **Πότε τρέχει:** κάθε μέρα στη 01:00 UTC — δηλαδή 04:00 ώρα Ελλάδας το καλοκαίρι (UTC+3)
  και 03:00 τον χειμώνα (UTC+2). Μπορείς να το τρέξεις και χειροκίνητα (βλ. παρακάτω).
- **Retention:** τα artifacts κρατιούνται 30 ημέρες και μετά διαγράφονται αυτόματα.

## 1. Ρύθμιση του MONGO_URL secret (μία φορά)

1. Πήγαινε στο GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. Πάτα **New repository secret**.
3. Name: `MONGO_URL`
4. Secret: το πλήρες connection string του Atlas, π.χ.
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
   ```
   (το ίδιο που χρησιμοποιεί το Render — αν το password έχει ειδικούς χαρακτήρες
   πρέπει να είναι URL-encoded).
5. Πάτα **Add secret**.

## 2. Χειροκίνητο backup

1. GitHub repo → tab **Actions** → workflow **MongoDB Backup**.
2. Πάτα **Run workflow** → **Run workflow** (branch: main).

## 3. Κατέβασμα ενός backup

1. GitHub repo → tab **Actions** → workflow **MongoDB Backup**.
2. Άνοιξε το run της ημέρας που θέλεις.
3. Στο κάτω μέρος της σελίδας, ενότητα **Artifacts**, κατέβασε το
   `mongo-backup-YYYY-MM-DD.tar.gz` (κατεβαίνει ως .zip που περιέχει το .tar.gz).

## 4. Restore με mongorestore

Χρειάζεσαι τα [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)
εγκατεστημένα τοπικά (περιλαμβάνουν `mongodump`/`mongorestore`).

1. Αποσυμπίεσε το backup:
   ```bash
   unzip mongo-backup-2026-07-13.tar.gz.zip   # αν κατέβηκε ως zip από το GitHub
   tar -xzf mongo-backup-2026-07-13.tar.gz    # δημιουργεί φάκελο dump/
   ```
2. Κάνε restore στο Atlas:
   ```bash
   mongorestore --uri="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/" dump/
   ```
   - Με `--drop` διαγράφει πρώτα τα υπάρχοντα collections πριν τα ξαναγράψει
     (πλήρης επαναφορά στην κατάσταση του backup):
     ```bash
     mongorestore --uri="..." --drop dump/
     ```
   - Για restore μόνο μίας βάσης ή collection:
     ```bash
     mongorestore --uri="..." --nsInclude="<db_name>.*" dump/
     ```

> ⚠️ Το `--drop` είναι καταστροφικό για τα τρέχοντα δεδομένα — σιγουρέψου ότι κάνεις
> restore το σωστό backup πριν το τρέξεις.
