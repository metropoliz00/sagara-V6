/**
 * Returns a YYYY-MM-DD string representing the local date.
 * Avoids timezone shifts that happen with new Date().toISOString().
 */
export const getLocalISODate = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

/**
 * Returns date in DD Month YYYY format
 */
export const formatDateID = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateString;
  }
};

/**
 * Returns a display string for time in WIB/WITA/WIT based on the user's timezone.
 */
export const getTimeWithZone = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  const offset = -date.getTimezoneOffset() / 60; // in hours
  let zone = 'WIB';
  if (offset === 8) zone = 'WITA';
  else if (offset === 9) zone = 'WIT';
  else if (offset !== 7) zone = `GMT${offset >= 0 ? '+' : ''}${offset}`;

  return `${hours}:${minutes}:${seconds} ${zone}`;
};
