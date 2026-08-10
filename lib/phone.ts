/**
 * Utility functions for African phone number cleaning & WhatsApp URL generation.
 */

export function normalizePhone(rawPhone?: string | null, defaultCountryCode = "237"): string | null {
  if (!rawPhone) return null;

  // Remove spaces, dots, dashes, parentheses
  let cleaned = rawPhone.replace(/[\s\.\-\(\)]/g, "");
  if (!cleaned) return null;

  // Handle leading zeros or +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // Remove any remaining non-digit chars
  cleaned = cleaned.replace(/\D/g, "");
  if (!cleaned) return null;

  // If phone starts with local 0 (e.g. 0699123456 -> 699123456)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If no country code attached yet (e.g., 9-digit Cameroonian number like 699123456)
  if (cleaned.length === 9 && !cleaned.startsWith(defaultCountryCode)) {
    cleaned = `${defaultCountryCode}${cleaned}`;
  }

  return `+${cleaned}`;
}

export function getWhatsAppLink(phone?: string | null, message?: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const digitsOnly = normalized.replace(/\+/g, "");
  const baseUrl = `https://wa.me/${digitsOnly}`;

  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }

  return baseUrl;
}
