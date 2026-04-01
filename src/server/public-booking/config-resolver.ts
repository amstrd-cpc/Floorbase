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

export type PublicVenueWithEvents = Pick<
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

function toLocalDateKey(date: Date, timeZone: string) {
  return formatDateForTimeZone(date, timeZone);
}

function eventMatchesDate(input: {
  event: BookingEvent;
  bookingDate: Date;
  timeZone: string;
}) {
  const bookingDateKey = toLocalDateKey(input.bookingDate, input.timeZone);

  if (input.event.eventType === BookingEventType.SINGLE_DATE) {
    if (!input.event.singleDate) {
      return false;
    }

    return toLocalDateKey(input.event.singleDate, input.timeZone) === bookingDateKey;
  }

  if (input.event.eventType === BookingEventType.DATE_RANGE) {
    if (!input.event.dateStart || !input.event.dateEnd) {
      return false;
    }

    const startKey = toLocalDateKey(input.event.dateStart, input.timeZone);
    const endKey = toLocalDateKey(input.event.dateEnd, input.timeZone);
    return bookingDateKey >= startKey && bookingDateKey <= endKey;
  }

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: input.timeZone,
    weekday: 'short'
  })
    .format(input.bookingDate)
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

  return input.event.weekdays.includes(map[weekday.slice(0, 3)]);
}

function applyEventOverrides(config: ResolvedBookingConfig, event: BookingEvent) {
  if (event.confirmationMode) {
    config.confirmationMode = event.confirmationMode;
  }
  if (event.placementMode) {
    config.placementMode = event.placementMode;
  }
  if (typeof event.minPartySize === 'number') {
    config.minPartySize = event.minPartySize;
  }
  if (typeof event.maxOnlinePartySize === 'number') {
    config.maxOnlinePartySize = event.maxOnlinePartySize;
  }
  if (typeof event.minAdvanceNoticeMinutes === 'number') {
    config.minAdvanceNoticeMinutes = event.minAdvanceNoticeMinutes;
  }
  if (typeof event.maxDaysAhead === 'number') {
    config.maxDaysAhead = event.maxDaysAhead;
  }
  if (typeof event.durationMinutes === 'number') {
    config.durationMinutes = event.durationMinutes;
  }
  if (typeof event.publicInstructions === 'string') {
    config.publicInstructions = event.publicInstructions;
  }
  if (typeof event.publicLabel === 'string') {
    config.publicLabel = event.publicLabel;
  }
  if (event.allowedAreaIds.length > 0) {
    config.allowedAreaIds = event.allowedAreaIds;
  }
  if (event.allowedTableIds.length > 0) {
    config.allowedTableIds = event.allowedTableIds;
  }
}

function eventSpecificity(type: BookingEventType) {
  if (type === BookingEventType.SINGLE_DATE) return 3;
  if (type === BookingEventType.DATE_RANGE) return 2;
  return 1;
}

export function resolveBookingConfig(input: {
  venue: PublicVenueWithEvents;
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

  const matched = input.venue.bookingEvents
    .filter((event) => event.isActive)
    .filter((event) =>
      eventMatchesDate({
        event,
        bookingDate: input.bookingDate,
        timeZone: input.venue.timezone
      })
    );

  const winningEvent =
    matched.length > 0
      ? [...matched].sort((a, b) => {
          const specificityDelta =
            eventSpecificity(b.eventType) - eventSpecificity(a.eventType);
          if (specificityDelta !== 0) {
            return specificityDelta;
          }

          return b.createdAt.getTime() - a.createdAt.getTime();
        })[0]
      : null;

  if (winningEvent) {
    applyEventOverrides(base, winningEvent);
  }

  if (base.maxOnlinePartySize < base.minPartySize) {
    base.maxOnlinePartySize = base.minPartySize;
  }

  return {
    config: base,
    matchedEvents: winningEvent ? [winningEvent] : []
  };
}
