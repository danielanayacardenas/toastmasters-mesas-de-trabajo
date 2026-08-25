import {
    type NoteInfo,
    type Participation,
    PREPARED_SPEECH_LABEL,
    ROLE_LABELS,
    SPEECH_START,
} from "./core";

const TZID = "America/Mexico_City";
const PRODID = "-//Toastmasters Guadalajara//Calendario//ES";

function escapeText(s: string): string {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

function octetLength(s: string): number {
    return new TextEncoder().encode(s).length;
}

function foldLine(line: string): string {
    const MAX = 75;
    if (octetLength(line) <= MAX) return line;

    const out: string[] = [];
    let current = "";
    let currentBytes = 0;

    for (const ch of line) {
        const chBytes = octetLength(ch);
        if (currentBytes + chBytes > MAX - 1) {
            out.push(current);
            current = " " + ch;
            currentBytes = 1 + chBytes;
        } else {
            current += ch;
            currentBytes += chBytes;
        }
    }
    if (current) out.push(current);

    return out.join("\r\n");
}

interface GroupedEvent {
    dateInt: number;
    roleIds: number[];
    hasSpeech: boolean;
    hasRole: boolean;
}

export interface IcsInvitationOptions {
    organizerEmail: string;
    attendeeEmail: string;
    attendeeName: string;
}

function groupByDate(participations: Participation[]): GroupedEvent[] {
    const map = new Map<number, GroupedEvent>();
    for (const [dateInt, roleId] of participations) {
        let entry = map.get(dateInt);
        if (!entry) {
            entry = { dateInt, roleIds: [], hasSpeech: false, hasRole: false };
            map.set(dateInt, entry);
        }
        if (!entry.roleIds.includes(roleId)) entry.roleIds.push(roleId);
        if (roleId >= SPEECH_START) entry.hasSpeech = true;
        else entry.hasRole = true;
    }
    return Array.from(map.values()).sort((a, b) => a.dateInt - b.dateInt);
}

function uidFor(person: string, dateInt: number): string {
    const slug = person
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return `${dateInt}-${slug || "tm"}@toastmasters-guadalajara`;
}

function todayStampUtc(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function escapeParameter(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function generateIcs(
    person: string,
    participations: Participation[],
    invitation?: IcsInvitationOptions,
    notes?: Record<number, NoteInfo | string>
): string {
    const events = groupByDate(participations);
    const isInvitation = Boolean(invitation);

    const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:${PRODID}`,
        "CALSCALE:GREGORIAN",
        `METHOD:${isInvitation ? "REQUEST" : "PUBLISH"}`,
        "X-WR-CALNAME:Toastmasters Guadalajara",
        `X-WR-TIMEZONE:${TZID}`,
        "BEGIN:VTIMEZONE",
        `TZID:${TZID}`,
        "BEGIN:STANDARD",
        "DTSTART:19701101T020000",
        "TZOFFSETFROM:-0500",
        "TZOFFSETTO:-0600",
        "TZNAME:CST",
        "END:STANDARD",
        "END:VTIMEZONE",
    ];

    const stamp = todayStampUtc();

    for (const ev of events) {
        const stampDate = String(ev.dateInt);
        const roleLabels = ev.roleIds
            .filter((id) => id < SPEECH_START)
            .map((id) => ROLE_LABELS[id] ?? `Rol ${id}`);
        const labels = ev.hasSpeech ? [PREPARED_SPEECH_LABEL, ...roleLabels] : roleLabels;
        const rolesLabel = labels.join(", ");
        const summary = ev.hasSpeech ? rolesLabel : `Mesa de Trabajo: ${rolesLabel}`;

        // Add note to description if exists — supports both NoteInfo and legacy string
        let description = rolesLabel;
        const rawNote = notes?.[ev.dateInt];
        if (rawNote) {
            const noteText = typeof rawNote === "string" ? rawNote : rawNote.text;
            description += `\n\nNota: ${noteText}`;
        }

        lines.push(
            "BEGIN:VEVENT",
            `UID:${uidFor(person, ev.dateInt)}`,
            `DTSTAMP:${stamp}`,
            `DTSTART;TZID=${TZID}:${stampDate}T200000`,
            `DTEND;TZID=${TZID}:${stampDate}T220000`,
            `SUMMARY:${escapeText(summary)}`,
            `DESCRIPTION:${escapeText(description)}`
        );

        if (invitation) {
            lines.push(
                "STATUS:CONFIRMED",
                "SEQUENCE:0",
                "TRANSP:OPAQUE",
                `ORGANIZER;CN=Toastmasters Guadalajara:mailto:${invitation.organizerEmail}`,
                `ATTENDEE;CN=${escapeParameter(invitation.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${invitation.attendeeEmail}`
            );
        }

        lines.push("END:VEVENT");

        const triggers: string[] = [];
        if (ev.hasSpeech) triggers.push("-P14D");
        if (ev.hasRole) triggers.push("-P7D");

        // Un mismo evento puede necesitar ambos recordatorios.
        const eventEnd = lines.length - 1;
        lines.splice(
            eventEnd,
            1,
            ...triggers.flatMap((trigger) => [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                `DESCRIPTION:${escapeText(summary)}`,
                `TRIGGER:${trigger}`,
                "END:VALARM",
            ]),
            "END:VEVENT"
        );
    }

    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
}
