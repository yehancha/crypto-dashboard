/**
 * Formats a price string to appropriate decimal places
 * Higher prices get fewer decimals, lower prices get more
 */
export function formatPrice(price: string): string {
  const numPrice = parseFloat(price);
  
  if (numPrice >= 1000) {
    return numPrice.toFixed(2);
  } else if (numPrice >= 1) {
    return numPrice.toFixed(4);
  } else {
    return numPrice.toFixed(6);
  }
}
