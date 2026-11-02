'use strict';

/** Hour of day (0–23) in `timeZone`, independent of the machine's own zone. */
function hourInZone(timeZone, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit' });
  const hourPart = fmt.formatToParts(date).find((p) => p.type === 'hour');
  const hour = Number.parseInt(hourPart.value, 10);
  return hour === 24 ? 0 : hour; // some ICU builds emit "24" at midnight
}

/** True when `date` falls in [startHour, endHour) in `timeZone`. */
function isWithinHours({ timeZone, startHour, endHour }, date = new Date()) {
  const hour = hourInZone(timeZone, date);
  return hour >= startHour && hour < endHour;
}

module.exports = { hourInZone, isWithinHours };
