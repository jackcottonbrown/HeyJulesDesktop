import { commitHeyJulesCalendarEvent, getHeyJulesDayContext } from "./HeyJulesApiClient.ts";
import { HeyJulesToolkit } from "./tools.ts";

export const HeyJulesToolkitHandlersLive = HeyJulesToolkit.toLayer({
  hey_jules_get_day_context: (input) => getHeyJulesDayContext(input),
  hey_jules_commit_calendar_event: (input) => commitHeyJulesCalendarEvent(input),
});
