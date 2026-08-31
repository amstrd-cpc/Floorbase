export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday?: number;
};

export function isValidIanaTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateTimeParts(
  date: Date,
  timeZone: string
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    weekday: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
      (lookup.weekday ?? '').slice(0, 3).toLowerCase()
    )
  };
}

export function zonedTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}) {
  let guessUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0
  );

  for (let index = 0; index < 3; index += 1) {
    const parts = getZonedDateTimeParts(new Date(guessUtc), input.timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0
    );
    const targetAsUtc = Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute,
      0,
      0
    );

    guessUtc += targetAsUtc - localAsUtc;
  }

  return new Date(guessUtc);
}

export function formatDateForTimeZone(date: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatDateTimeForTimeZone(date: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function startOfZonedDayUtc(date: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    timeZone
  });
}

export function addZonedDaysUtc(date: Date, timeZone: string, days: number) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day + days,
    hour: parts.hour,
    minute: parts.minute,
    timeZone
  });
}
