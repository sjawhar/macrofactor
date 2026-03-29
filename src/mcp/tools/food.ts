import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LogTime, MacroFactorClient } from '../../lib/api/index.js';
import { z } from 'zod';

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseLogTime(input: { date?: string; hour?: number; minute?: number }): LogTime {
  const now = new Date();
  return {
    date: input.date ?? todayDate(),
    hour: input.hour ?? now.getHours(),
    minute: input.minute ?? now.getMinutes(),
  };
}

type FoodServing = { description: string; gramWeight: number; amount: number };

function findServing(servings: FoodServing[], unit: string): FoodServing | undefined {
  if (['g', 'gram', 'grams'].includes(unit.toLowerCase())) {
    return (
      servings.find((s) => s.gramWeight === 1 && s.description.toLowerCase().includes('gram')) ||
      servings.find((s) => s.gramWeight === 1) ||
      servings.find((s) => s.description === '100 g')
    );
  }

  const aliases: Record<string, string[]> = {
    tbsp: ['tbsp', 'tablespoon'],
    tsp: ['tsp', 'teaspoon'],
    cup: ['cup'],
    oz: ['oz'],
    lb: ['lb'],
    ml: ['ml'],
    serving: ['serving'],
  };
  const targets = aliases[unit.toLowerCase()] || [unit.toLowerCase()];
  return servings.find((s) => targets.some((t) => s.description.toLowerCase().includes(t)));
}

function isGramServing(serving: FoodServing): boolean {
  const description = serving.description.toLowerCase();
  return (
    description === 'g' ||
    description === 'gram' ||
    description === 'grams' ||
    (serving.gramWeight === 1 && serving.amount === 1)
  );
}

/**
 * Nudge the MacroFactor app to recompute a day's dashboard totals.
 * Adding a dummy entry triggers the Firestore listener; wait 3s for
 * the app to process it, then hard-delete.
 */
async function syncDayDashboard(client: MacroFactorClient, date: string): Promise<void> {
  const logTime = { date, hour: 0, minute: 0 };
  await client.logFood(logTime, '_sync', 0, 0, 0, 0);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const entries = await client.getFoodLog(date);
  const dummy = entries.find((e) => !e.deleted && e.name === '_sync');
  if (dummy) {
    await client.hardDeleteFoodEntry(date, dummy.entryId);
  }
}
export function registerFoodTools(server: McpServer, client: MacroFactorClient): void {
  server.tool(
    'get_food_log',
    `Retrieve a day's food log entries and return them as JSON after filtering out deleted items. Use this when you need entry IDs or meal details before updates, copies, or deletes. Do not use this for macro totals over date ranges, because get_nutrition is a better fit for aggregate analysis. If you do not provide a date, the tool uses today's local date in YYYY-MM-DD format; see also update_food and copy_food_entries.`,
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    },
    { readOnlyHint: true },
    async ({ date }) => {
      const entries = await client.getFoodLog(date ?? todayDate());
      const active = entries.filter((entry) => !entry.deleted);
      return { content: [{ type: 'text' as const, text: JSON.stringify(active, null, 2) }] };
    }
  );

  server.tool(
    'search_foods',
    `Search the MacroFactor food database by text query and return matching foods and serving options. Use this before log_food when you need a candidate food and serving metadata for precise logging. Do not use this for custom manual foods with direct macro numbers; use log_manual_food for that path. If results are ambiguous, refine the query string and run the search again before logging.`,
    { query: z.string().min(1) },
    { readOnlyHint: true },
    async ({ query }) => {
      const results = await client.searchFoods(query);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    'log_food',
    `Search for a food by query, select the first match, resolve a serving, and log it to the food diary using LogTime fields. Use this for standard catalog foods where you want search-driven logging in one step. Do not use this when the food is not in search results or you already have direct macro values; use log_manual_food in those cases. If no serving preference is provided, this tool defaults to a gram-style serving and quantity 100; related tools include search_foods and update_food.`,
    {
      query: z.string().min(1),
      grams: z.number().positive().optional(),
      amount: z.number().positive().optional(),
      unit: z.string().min(1).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      hour: z.number().int().min(0).max(23).optional(),
      minute: z.number().int().min(0).max(59).optional(),
    },
    { destructiveHint: false },
    async ({ query, grams, amount, unit, date, hour, minute }) => {
      const results = await client.searchFoods(query);
      const food = results[0];
      if (!food) {
        throw new Error(`No food results found for query "${query}"`);
      }

      let serving = findServing(food.servings, 'g') ?? food.servings[0];
      let quantity = grams ?? 100;
      let gramMode = true;

      if (amount != null && unit) {
        serving = findServing(food.servings, unit) ?? food.servings[0];
        quantity = amount;
        gramMode = isGramServing(serving);
      } else if (grams != null) {
        serving = findServing(food.servings, 'g') ?? food.servings[0];
        quantity = grams;
        gramMode = true;
      }

      const logTime = parseLogTime({ date, hour, minute });
      await client.logSearchedFood(logTime, food, serving, quantity, gramMode);

      await syncDayDashboard(client, logTime.date);
      const result = {
        status: 'logged',
        food: food.name,
        foodId: food.foodId,
        serving: serving.description,
        quantity,
        date: logTime.date,
        hour: logTime.hour,
        minute: logTime.minute,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'log_manual_food',
    `Log a manual food entry by directly providing calories and macros, then return a JSON confirmation payload. Use this when the food is not in the searchable database or when you want exact custom macro values. Do not use this for searchable branded/common foods, because log_food can preserve richer serving metadata from the catalog. If you need to modify the logged quantity afterward, call update_food with the returned date and entry ID from get_food_log.`,
    {
      name: z.string().min(1),
      calories: z.number().min(0),
      protein: z.number().min(0),
      carbs: z.number().min(0),
      fat: z.number().min(0),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      hour: z.number().int().min(0).max(23).optional(),
      minute: z.number().int().min(0).max(59).optional(),
    },
    { destructiveHint: false },
    async ({ name, calories, protein, carbs, fat, date, hour, minute }) => {
      const logTime = parseLogTime({ date, hour, minute });
      await client.logFood(logTime, name, calories, protein, carbs, fat);
      await syncDayDashboard(client, logTime.date);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { status: 'logged', name, date: logTime.date, hour: logTime.hour, minute: logTime.minute },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'update_food',
    `Update the quantity for an existing food entry on a specific date and return an update confirmation JSON payload. Use this when you already know the target entry ID and need to correct quantity without creating duplicate entries. Do not use this to change to a different food item or to remove entries; use delete_food/hard_delete_food for removal workflows. Prerequisite: call get_food_log first if you need to discover entry IDs for that day.`,
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entryId: z.string().min(1),
      quantity: z.number().positive(),
    },
    { destructiveHint: false },
    async ({ date, entryId, quantity }) => {
      await client.updateFoodEntry(date, entryId, quantity);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ status: 'updated', date, entryId, quantity }, null, 2) },
        ],
      };
    }
  );

  server.tool(
    'delete_food',
    `Soft-delete a food entry by setting its deleted flag and return a deletion confirmation object. Use this when you want the standard app-consistent deletion behavior that preserves underlying history records. Do not use this for permanent field removal from Firestore, because hard_delete_food is the irreversible path. Prerequisite: obtain a valid entryId via get_food_log before calling this tool; see also hard_delete_food for permanent deletion.`,
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entryId: z.string().min(1),
    },
    { destructiveHint: true },
    async ({ date, entryId }) => {
      await client.deleteFoodEntry(date, entryId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deleted', date, entryId }, null, 2) }],
      };
    }
  );

  server.tool(
    'hard_delete_food',
    `Permanently remove a food entry field from the day document and return a hard-delete confirmation payload. Use this only when you explicitly need irreversible cleanup behavior and understand the data-loss implications. Do not use this for normal day-to-day corrections where soft delete is safer and closer to app behavior; use delete_food instead. Prerequisite: get_food_log to identify the exact entryId, and consider update_food when the goal is quantity correction.`,
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entryId: z.string().min(1),
    },
    { destructiveHint: true },
    async ({ date, entryId }) => {
      await client.hardDeleteFoodEntry(date, entryId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'hard-deleted', date, entryId }, null, 2) }],
      };
    }
  );

  server.tool(
    'copy_food_entries',
    `Copy one or more food entries from a source date to a target date and return a summary of copied count. Use this for meal cloning workflows where you want to reuse prior entries without re-logging each food. Do not use this for a full day nutrition analysis or for deleting entries; use get_nutrition and delete_food respectively. Prerequisite: call get_food_log on the source date if you need entry IDs; when entryIds are omitted, all non-deleted entries from the source date are copied.`,
    {
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entryIds: z.array(z.string().min(1)).optional(),
    },
    { destructiveHint: false },
    async ({ fromDate, toDate, entryIds }) => {
      const sourceLog = await client.getFoodLog(fromDate);
      const activeEntries = sourceLog.filter((entry) => !entry.deleted);
      const selectedEntries = entryIds?.length
        ? activeEntries.filter((entry) => entryIds.includes(entry.entryId))
        : activeEntries;

      await client.copyEntries(toDate, selectedEntries);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'copied',
                fromDate,
                toDate,
                copied: selectedEntries.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
