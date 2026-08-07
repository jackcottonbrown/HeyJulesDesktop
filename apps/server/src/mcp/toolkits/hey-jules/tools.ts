import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

export class HeyJulesApiError extends Schema.TaggedErrorClass<HeyJulesApiError>()(
  "HeyJulesApiError",
  {
    operation: Schema.String,
    status: Schema.optional(Schema.Number),
    detail: Schema.String,
  },
) {}

const DateString = Schema.String.annotate({ description: "Calendar date in YYYY-MM-DD format." });

export const HeyJulesDayContext = Schema.Struct({
  date: Schema.String,
  dayLabel: Schema.String,
  timezone: Schema.String,
  briefing: Schema.String,
  counts: Schema.Struct({
    calendarEvents: Schema.Number,
    activities: Schema.Number,
    goals: Schema.Number,
    lifeContext: Schema.Number,
  }),
});

export const HeyJulesCalendarEvent = Schema.Struct({
  event: Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    start: Schema.String,
    end: Schema.String,
    location: Schema.NullOr(Schema.String),
    htmlLink: Schema.NullOr(Schema.String),
  }),
});

const HeyJulesGetDayContextInput = Schema.Struct({ date: DateString });

const HeyJulesCommitCalendarEventInput = Schema.Struct({
  title: Schema.String.annotate({ description: "Plain-language event title." }),
  start: Schema.String.annotate({ description: "ISO 8601 start with an explicit UTC offset." }),
  end: Schema.String.annotate({ description: "ISO 8601 end with an explicit UTC offset." }),
  description: Schema.optional(
    Schema.NullOr(
      Schema.String.annotate({ description: "Optional details to store on the event." }),
    ),
  ),
  location: Schema.optional(
    Schema.NullOr(Schema.String.annotate({ description: "Optional event location." })),
  ),
  category: Schema.Literals([
    "work",
    "health",
    "social",
    "hard_stop",
    "personal",
    "transit",
    "meal",
    "admin",
    "learning",
    "outdoor",
    "idea",
  ]).annotate({ description: "Hey Jules category used for styling and calendar semantics." }),
  commitmentLevel: Schema.Literals(["firm", "tentative", "aspirational"]).annotate({
    description: "How strongly the user committed to this event.",
  }),
});

export type HeyJulesGetDayContextInput = typeof HeyJulesGetDayContextInput.Type;
export type HeyJulesCommitCalendarEventInput = typeof HeyJulesCommitCalendarEventInput.Type;

export const HeyJulesGetDayContextTool = Tool.make("hey_jules_get_day_context", {
  description:
    "Load the authenticated user's real Hey Jules planning briefing for one calendar date. Call this before proposing a daily plan; do not substitute filesystem or shell inspection.",
  parameters: HeyJulesGetDayContextInput,
  success: HeyJulesDayContext,
  failure: HeyJulesApiError,
})
  .annotate(Tool.Title, "Load Hey Jules day context")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

export const HeyJulesCommitCalendarEventTool = Tool.make("hey_jules_commit_calendar_event", {
  description:
    "Create exactly one calendar event after the user has explicitly accepted the proposed change. This is consequential and must remain behind the harness's inline approval UI. Never call it merely to demonstrate a plan.",
  parameters: HeyJulesCommitCalendarEventInput,
  success: HeyJulesCalendarEvent,
  failure: HeyJulesApiError,
  needsApproval: true,
})
  .annotate(Tool.Title, "Create approved Hey Jules calendar event")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, true);

export const HeyJulesToolkit = Toolkit.make(
  HeyJulesGetDayContextTool,
  HeyJulesCommitCalendarEventTool,
);
