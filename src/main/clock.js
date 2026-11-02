'use strict';

/** Hour of day (0–23) in `timeZone`, or in the machine's local zone if omitted. */
function hourInZone(timeZone, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit' });
  const hourPart = fmt.formatToParts(date).find((p) => p.type === 'hour');
  const hour = Number.parseInt(hourPart.value, 10);
  return hour === 24 ? 0 : hour; // some ICU builds emit "24" at midnight
}

/**
 * True when `date` falls in [startHour, endHour). Ranges may wrap past
 * midnight (22 → 6), and startHour === endHour means all day.
 */
function isWithinHours({ startHour, endHour, timeZone }, date = new Date()) {
  if (startHour === endHour) return true;
  const hour = hourInZone(timeZone, date);
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

module.exports = { hourInZone, isWithinHours };
