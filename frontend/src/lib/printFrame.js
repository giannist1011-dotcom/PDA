// Kiosk Relay — εκτύπωση HTML σε κρυφό iframe, ανεξάρτητα από το #print-area
// της τρέχουσας σελίδας (ώστε ένα relay job να μην «κολλήσει» πάνω σε απόδειξη
// που έχει ήδη mounted η σελίδα του σταθμού). Με Chrome --kiosk-printing το
// print() του iframe βγαίνει αθόρυβα στον προεπιλεγμένο θερμικό εκτυπωτή.
//
// Ταχύτητα: ΕΝΑ μόνιμο iframe που επαναχρησιμοποιείται σε κάθε job (χωρίς
// δημιουργία/αφαίρεση DOM) και ΚΑΝΕΝΑ network fetch — inline CSS και μόνο
// τοπικές γραμματοσειρές, ώστε το print() να καλείται μόλις γίνει ready το DOM.

// Ίδιοι κανόνες με το @media print του index.css (θερμικός 80mm / 72mm ωφέλιμο),
// χωρίς τα visibility tricks — στο iframe υπάρχει ΜΟΝΟ η απόδειξη.
const FRAME_CSS = `
  body { margin: 0; }
  #print-area {
    width: 72mm;
    background: white;
    color: black;
    padding: 1mm 0 5mm;
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  #print-area * { color: black; }
  #print-area hr { border: none; border-top: 2px solid #000; margin: 7px 0; }
  #print-area .receipt-title { font-size: 22px; font-weight: 800; line-height: 1.2; }
  #print-area .rc-cust { font-size: 13px; font-weight: 400; }
  #print-area .rc-big { font-size: 17px; font-weight: 800; }
  #print-area .rc-row { display: flex; justify-content: space-between; gap: 6px; }
  #print-area .rc-row > :first-child { min-width: 0; }
  #print-area .rc-price { white-space: nowrap; }
  #print-area .rc-item { font-size: 18px; font-weight: 800; line-height: 1.3; }
  #print-area .rc-mod { font-size: 13px; font-weight: 400; padding-left: 10px; }
  #print-area .rc-note { font-size: 17px; font-weight: 800; border: 2px solid #000; padding: 4px 6px; }
  #print-area .rc-total { font-size: 20px; font-weight: 800; }
  #print-area .rc-foot { font-size: 12px; text-align: center; }
  #print-area .text-center { text-align: center; }
  /* Fallback για jobs που έχουν μόνο plain text (42 στήλες) */
  #print-area pre { margin: 0; font: inherit; font-size: 11px; white-space: pre-wrap; }
  @page { size: 72mm auto; margin: 0; }
`;

let _frame = null;

function getFrame() {
  if (_frame && _frame.isConnected) return _frame;
  _frame = document.createElement("iframe");
  _frame.setAttribute("aria-hidden", "true");
  _frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(_frame);
  return _frame;
}

export function printHtmlInFrame(html) {
  return new Promise((resolve, reject) => {
    try {
      const iframe = getFrame();
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(
        `<!doctype html><html><head><meta charset="utf-8">` +
          `<style>${FRAME_CSS}</style></head><body>${html}</body></html>`
      );
      doc.close();
      let printed = false;
      const doPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      // Χωρίς external resources το doc.write/close ολοκληρώνεται αμέσως —
      // τυπώνουμε στο load (όχι με timer), με δίχτυ ασφαλείας 300ms.
      if (doc.readyState === "complete") {
        doPrint();
      } else {
        iframe.contentWindow.addEventListener("load", doPrint, { once: true });
        setTimeout(doPrint, 300);
      }
    } catch (e) {
      reject(e);
    }
  });
}
