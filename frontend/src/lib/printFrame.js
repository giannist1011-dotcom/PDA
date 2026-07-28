// Kiosk Relay — εκτύπωση HTML σε κρυφό iframe, ανεξάρτητα από το #print-area
// της τρέχουσας σελίδας (ώστε ένα relay job να μην «κολλήσει» πάνω σε απόδειξη
// που έχει ήδη mounted η σελίδα του σταθμού). Με Chrome --kiosk-printing το
// print() του iframe βγαίνει αθόρυβα στον προεπιλεγμένο θερμικό εκτυπωτή.

// Ίδιοι κανόνες με το @media print του index.css (θερμικός 80mm / 72mm ωφέλιμο),
// χωρίς τα visibility tricks — στο iframe υπάρχει ΜΟΝΟ η απόδειξη.
const FRAME_CSS = `
  body { margin: 0; }
  #print-area {
    width: 72mm;
    background: white;
    color: black;
    padding: 1mm 0 5mm;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  #print-area * { color: black; }
  #print-area hr { border: none; border-top: 2px solid #000; margin: 7px 0; }
  #print-area .receipt-title { font-size: 22px; font-weight: 800; line-height: 1.2; }
  #print-area .rc-sub { font-size: 13px; }
  #print-area .rc-big { font-size: 17px; font-weight: 800; }
  #print-area .rc-row { display: flex; justify-content: space-between; gap: 6px; }
  #print-area .rc-row > :first-child { min-width: 0; }
  #print-area .rc-price { white-space: nowrap; }
  #print-area .rc-item { font-size: 18px; font-weight: 800; line-height: 1.3; }
  #print-area .rc-mod { font-size: 15px; font-weight: 700; padding-left: 10px; }
  #print-area .rc-note { font-size: 17px; font-weight: 800; border: 2px solid #000; padding: 4px 6px; }
  #print-area .rc-total { font-size: 20px; font-weight: 800; }
  #print-area .rc-foot { font-size: 12px; text-align: center; }
  #print-area .text-center { text-align: center; }
  /* Fallback για jobs που έχουν μόνο plain text (42 στήλες) */
  #print-area pre { margin: 0; font: inherit; font-size: 11px; white-space: pre-wrap; }
  @page { size: 72mm auto; margin: 0; }
`;

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap";

export function printHtmlInFrame(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const cleanup = () => {
      // το print() του Chrome είναι blocking — όταν επιστρέψει, το iframe μπορεί να φύγει
      setTimeout(() => iframe.remove(), 1000);
    };
    try {
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(
        `<!doctype html><html><head><meta charset="utf-8">` +
          `<link rel="stylesheet" href="${FONT_LINK}">` +
          `<style>${FRAME_CSS}</style></head><body>${html}</body></html>`
      );
      doc.close();
      // μικρή αναμονή για layout + φόρτωση γραμματοσειράς (με όριο — αν αργεί,
      // τυπώνουμε με τη fallback monospace αντί να καθυστερεί η ουρά)
      const fontsReady = doc.fonts?.ready || Promise.resolve();
      Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(() => {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            cleanup();
            resolve();
          } catch (e) {
            cleanup();
            reject(e);
          }
        }, 150);
      });
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}
