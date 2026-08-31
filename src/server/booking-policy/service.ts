import {
  BookingEventType,
  type BookingEvent,
  type Venue,
  type VenueBookingMode,
  type VenuePlacementMode
} from '@prisma/client';
import { formatDateForTimeZone } from '@/lib/timezone';

export type ResolvedBookingConfig = {
  publicBookingEnabled: boolean;
  confirmationMode: VenueBookingMode;
  placementMode: VenuePlacementMode;
  minPartySize: number;
  maxOnlinePartySize: number;
  minAdvanceNoticeMinutes: number;
  maxDaysAhead: number;
  durationMinutes: number;
  publicInstructions: string | null;
  publicLabel: string | null;
  allowedAreaIds: string[];
  allowedTableIds: string[];
};

export type BookingVenueWithEvents = Pick<
  Venue,
  | 'id'
  | 'organizationId'
  | 'slug'
  | 'name'
  | 'timezone'
  | 'publicBookingEnabled'
  | 'bookingMode'
  | 'placementMode'
  | 'minPartySize'
  | 'maxOnlinePartySize'
  | 'minAdvanceNoticeMinutes'
  | 'maxDaysAhead'
  | 'defaultReservationDurationMinutes'
  | 'publicInstructions'
> & { bookingEvents: BookingEvent[] };

function eventTypeSpecificity(type: BookingEventType) {
  if (type === BookingEventType.SINGLE_DATE) return 3;
  if (type === BookingEventType.DATE_RANGE) return 2;
  return 1;
}

function localDateKey(date: Date, timeZone: string) {
  return formatDateForTimeZone(date, timeZone);
}

function getWeekdayIndex(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short'
  })
    .format(date)
    .toLowerCase();

  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  };

  return map[weekday.slice(0, 3)] ?? -1;
}

function eventMatchesDate(
  event: BookingEvent,
  bookingDate: Date,
  timeZone: string
) {
  const bookingDateKey = localDateKey(bookingDate, timeZone);

  if (event.eventType === BookingEventType.SINGLE_DATE) {
    if (!event.singleDate) return false;
    return localDateKey(event.singleDate, timeZone) === bookingDateKey;
  }

  if (event.eventType === BookingEventType.DATE_RANGE) {
    if (!event.dateStart || !event.dateEnd) return false;

    const startKey = localDateKey(event.dateStart, timeZone);
    const endKey = localDateKey(event.dateEnd, timeZone);
    return bookingDateKey >= startKey && bookingDateKey <= endKey;
  }

  const weekday = getWeekdayIndex(bookingDate, timeZone);
  return weekday >= 0 && event.weekdays.includes(weekday);
}

function dateRangeSpanDays(event: BookingEvent, timeZone: string) {
  if (!event.dateStart || !event.dateEnd) return Number.POSITIVE_INFINITY;
  const start = new Date(
    `${localDateKey(event.dateStart, timeZone)}T00:00:00.000Z`
  );
  const end = new Date(
    `${localDateKey(event.dateEnd, timeZone)}T00:00:00.000Z`
  );
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000)
  );
}

function compareMatchedEvents(
  a: BookingEvent,
  b: BookingEvent,
  timeZone: string
) {
  const specificityDelta =
    eventTypeSpecificity(b.eventType) - eventTypeSpecificity(a.eventType);
  if (specificityDelta !== 0) return specificityDelta;

  if (
    a.eventType === BookingEventType.DATE_RANGE &&
    b.eventType === BookingEventType.DATE_RANGE
  ) {
    const spanDelta =
      dateRangeSpanDays(a, timeZone) - dateRangeSpanDays(b, timeZone);
    if (spanDelta !== 0) return spanDelta;
  }

  const createdDelta = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdDelta !== 0) return createdDelta;

  return b.id.localeCompare(a.id);
}

function applyEventOverrides(
  config: ResolvedBookingConfig,
  event: BookingEvent
) {
  if (event.confirmationMode) config.confirmationMode = event.confirmationMode;
  if (event.placementMode) config.placementMode = event.placementMode;
  if (typeof event.minPartySize === 'number')
    config.minPartySize = event.minPartySize;
  if (typeof event.maxOnlinePartySize === 'number')
    config.maxOnlinePartySize = event.maxOnlinePartySize;
  if (typeof event.minAdvanceNoticeMinutes === 'number') {
    config.minAdvanceNoticeMinutes = event.minAdvanceNoticeMinutes;
  }
  if (typeof event.maxDaysAhead === 'number')
    config.maxDaysAhead = event.maxDaysAhead;
  if (typeof event.durationMinutes === 'number')
    config.durationMinutes = event.durationMinutes;
  if (typeof event.publicInstructions === 'string')
    config.publicInstructions = event.publicInstructions;
  if (typeof event.publicLabel === 'string')
    config.publicLabel = event.publicLabel;
  if (event.allowedAreaIds.length > 0)
    config.allowedAreaIds = event.allowedAreaIds;
  if (event.allowedTableIds.length > 0)
    config.allowedTableIds = event.allowedTableIds;
}

export function resolveBookingConfig(input: {
  venue: BookingVenueWithEvents;
  bookingDate: Date;
}) {
  const base: ResolvedBookingConfig = {
    publicBookingEnabled: input.venue.publicBookingEnabled,
    confirmationMode: input.venue.bookingMode,
    placementMode: input.venue.placementMode,
    minPartySize: input.venue.minPartySize,
    maxOnlinePartySize: input.venue.maxOnlinePartySize,
    minAdvanceNoticeMinutes: input.venue.minAdvanceNoticeMinutes,
    maxDaysAhead: input.venue.maxDaysAhead,
    durationMinutes: input.venue.defaultReservationDurationMinutes,
    publicInstructions: input.venue.publicInstructions,
    publicLabel: null,
    allowedAreaIds: [],
    allowedTableIds: []
  };

  const matchedEvents = input.venue.bookingEvents
    .filter((event) => event.isActive)
    .filter((event) =>
      eventMatchesDate(event, input.bookingDate, input.venue.timezone)
    )
    .sort((a, b) => compareMatchedEvents(a, b, input.venue.timezone));

  const winningEvent = matchedEvents[0] ?? null;
  if (winningEvent) {
    applyEventOverrides(base, winningEvent);
  }

  if (base.maxOnlinePartySize < base.minPartySize) {
    base.maxOnlinePartySize = base.minPartySize;
  }

  return {
    config: base,
    winningEvent,
    matchedEvents
  };
}
