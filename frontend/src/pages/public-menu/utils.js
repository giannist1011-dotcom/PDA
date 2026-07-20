// URL Google Maps για οδηγίες προς το κατάστημα — συντεταγμένες αν υπάρχουν,
// αλλιώς αναζήτηση με τη διεύθυνση κειμένου
export const buildDirectionsUrl = ({ store_lat, store_lng, store_address, store_city }) => {
  if (store_lat != null && store_lng != null)
    return `https://www.google.com/maps/dir/?api=1&destination=${store_lat},${store_lng}`;
  const address = [store_address, store_city].filter(Boolean).join(", ");
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
};
