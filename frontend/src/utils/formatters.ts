/**
 * Formats numbers into Bangladeshi Taka (৳ BDT) using proper South Asian grouping.
 * Examples:
 *   formatBDT(57500) -> "৳ 57,500"
 *   formatBDT(125500.5) -> "৳ 1,25,500.50"
 */
export function formatBDT(
  amount: number | string | null | undefined,
  showDecimals = false
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '৳ 0';
  }

  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  if (isNaN(num)) {
    return '৳ 0';
  }

  const hasFractions = num % 1 !== 0;

  try {
    const formatted = showDecimals || hasFractions
      ? num.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : num.toLocaleString('en-IN', {
          maximumFractionDigits: 0,
        });

    return `৳ ${formatted}`;
  } catch {
    return `৳ ${num.toFixed(showDecimals || hasFractions ? 2 : 0)}`;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
