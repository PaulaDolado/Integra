export const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

// Validación estándar ISO 13616: reordenar, pasar letras a números y comprobar mod 97
export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("ES") && iban.length !== 24) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

export const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();

// Solo se muestran los 4 últimos dígitos
export const maskIban = (iban: string) => {
  const clean = normalizeIban(iban);
  return formatIban(clean.slice(0, 2) + "•".repeat(clean.length - 6) + clean.slice(-4));
};
