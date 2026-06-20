/**
 * Utility functions for international phone number formatting and validation for WhatsApp.
 */

/**
 * Automatically formats a phone number for WhatsApp API usage in E.164 format.
 * 1. Strips all non-digit characters.
 * 2. Checks if user selected country code.
 * 3. Removes any leading zeros from local phone number (e.g. '012' becomes '12').
 * 4. Merges with selected country code to form complete E.164 output (e.g. +60123456789).
 * 
 * @param countryCode The country code selection, e.g. "+60" or "+673"
 * @param phoneNumber The inputted phone number text
 */
export function formatWhatsAppNumber(countryCode: string, phoneNumber: string): string {
  if (!phoneNumber) return '';

  // Get digits of country code, e.g. "60" or "673"
  const ccDigits = countryCode.replace(/\D/g, '');

  // Strip all non-digit characters from the input number
  let cleaned = phoneNumber.replace(/\D/g, '');

  // If input number actually starts with the country code digits format, strip it so we can clean local zeros cleanly
  if (ccDigits && cleaned.startsWith(ccDigits)) {
    cleaned = cleaned.substring(ccDigits.length);
  }

  // Remove leading zeroes
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  return `${countryCode}${cleaned}`;
}

/**
 * Validates whether the formatted phone number has enough valid digits for WhatsApp usage.
 * E.g. "+60123456789" has country code "+60" / "+673" and appropriate local digits (7-10 digits).
 * 
 * @param formattedNumber The E.164 formatted number starting with +
 */
export function isValidWhatsAppNumber(formattedNumber: string): boolean {
  if (!formattedNumber) return false;
  if (!formattedNumber.startsWith('+')) return false;

  const digits = formattedNumber.replace(/\D/g, '');
  // A valid WhatsApp number would have country code + local number.
  // Malaysia: country code 60 (2 digits) + 9-10 digits = 11 to 12 digits.
  // Brunei: country code 673 (3 digits) + 7 digits = 10 digits.
  // Let's be lenient and say total digit length should be between 9 and 15.
  return digits.length >= 9 && digits.length <= 15;
}
