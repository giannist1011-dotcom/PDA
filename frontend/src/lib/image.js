// Κοινές βοηθητικές για ανέβασμα εικόνων: διάβασμα ως data URL + σμίκρυνση στον browser
// ώστε οι εγγραφές στη βάση να μένουν μικρές (ίδια λογική με τις φωτογραφίες προϊόντων).

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("Read error"));
    fr.readAsDataURL(file);
  });
}

export async function shrinkDataUrl(dataUrl, maxDim = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      // PNG διατηρεί διαφάνεια — κατάλληλο για λογότυπα
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Δεν φορτώθηκε η εικόνα"));
    img.src = dataUrl;
  });
}
