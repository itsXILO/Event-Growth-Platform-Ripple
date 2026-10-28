/**
 * Calendar Utilities: RFC 5545 iCalendar (.ics) generation & Add-to-Calendar web links
 */

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export interface CalendarEventDetails {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  durationMinutes?: number;
  url?: string;
}

/**
 * Generates an RFC 5545 standard .ics file string
 */
export function generateIcsCalendar(details: CalendarEventDetails): string {
  const duration = details.durationMinutes || 60;
  const endsAt = new Date(details.startsAt.getTime() + duration * 60 * 1000);
  const now = new Date();
  const uid = `event-nxtwave-${details.startsAt.getTime()}@ripple.local`;

  // Escape special iCalendar characters: backslash, semicolon, comma, newlines
  const escapeIcs = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ripple Growth Platform//NxtWave AI Workshop//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(details.startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    `SUMMARY:${escapeIcs(details.title)}`,
    `DESCRIPTION:${escapeIcs(details.description)}`,
    `LOCATION:${escapeIcs(details.location)}`,
    details.url ? `URL:${details.url}` : "",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: AI Project in 60 Minutes Workshop starts soon!",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/**
 * Generate 1-click Google Calendar Add-to-Calendar URL
 */
export function getGoogleCalendarUrl(details: CalendarEventDetails): string {
  const duration = details.durationMinutes || 60;
  const endsAt = new Date(details.startsAt.getTime() + duration * 60 * 1000);
  const dates = `${formatIcsDate(details.startsAt)}/${formatIcsDate(endsAt)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: details.title,
    dates,
    details: details.description,
    location: details.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate 1-click Outlook Add-to-Calendar URL
 */
export function getOutlookCalendarUrl(details: CalendarEventDetails): string {
  const duration = details.durationMinutes || 60;
  const endsAt = new Date(details.startsAt.getTime() + duration * 60 * 1000);

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: details.title,
    startdt: details.startsAt.toISOString(),
    enddt: endsAt.toISOString(),
    body: details.description,
    location: details.location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
