/** Shared race / goal event for the countdown sticker (editor “Add event”). */
export type RaceEvent = {
    name: string;
    /** ISO date YYYY-MM-DD */
    date: string;
};

let raceEvent: RaceEvent = {
    name: 'TCS New York Marathon',
    date: '2026-11-01',
};

export function getRaceEvent(): RaceEvent {
    return raceEvent;
}

export function setRaceEvent(patch: Partial<RaceEvent>): RaceEvent {
    raceEvent = { ...raceEvent, ...patch };
    return raceEvent;
}

export function daysUntil(isoDate: string, from = new Date()): number {
    const target = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return 0;
    const ms = target.getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    return Math.max(0, Math.round(ms / 86400000));
}
