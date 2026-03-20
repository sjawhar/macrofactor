import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MacroFactorClient } from '../../lib/api/index.js';
import { z } from 'zod';

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function registerWeightTools(server: McpServer, client: MacroFactorClient): void {
  server.tool(
    'get_weight_entries',
    `Fetch scale entries for the requested date range and return normalized weight history JSON. Use this to analyze bodyweight trends, compare to nutrition adherence, or feed context dashboards. Do not use this for a single-day write action; use log_weight to create entries or delete_weight to remove one. Prerequisite: provide startDate and endDate in YYYY-MM-DD format; related tools include get_context and get_nutrition.`,
    {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    },
    { readOnlyHint: true },
    async ({ startDate, endDate }) => {
      const entries = await client.getWeightEntries(startDate, endDate);
      return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
    }
  );

  server.tool(
    'log_weight',
    `Log a bodyweight entry using either kilograms or pounds and return a confirmation JSON payload. Use this for new daily scale entries and optional body-fat values; pounds are converted to kilograms internally before writing. Do not use this to edit or remove existing entries, because this tool only writes a value for a day and delete_weight handles removal. If you provide lbs and kg together, kg takes precedence; if date is omitted, today's local date is used.`,
    {
      lbs: z.number().positive().optional(),
      kg: z.number().positive().optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      bodyFat: z.number().optional(),
    },
    { destructiveHint: false },
    async ({ lbs, kg, date, bodyFat }) => {
      if (kg == null && lbs == null) {
        throw new Error('log_weight requires either kg or lbs');
      }

      const weightKg = kg ?? Number(lbs) / 2.2046226218;
      const targetDate = date ?? todayDate();
      await client.logWeight(targetDate, weightKg, bodyFat);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { status: 'logged', date: targetDate, kg: Math.round(weightKg * 1000) / 1000, bodyFat },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'delete_weight',
    `Delete a scale entry for a specific date and return a JSON status response. Use this when an accidental or incorrect daily weigh-in needs to be removed. Do not use this to overwrite a weight value; prefer log_weight to write the corrected number directly when possible. Prerequisite: know the exact date string (YYYY-MM-DD) to remove; see also get_weight_entries to discover existing dates first.`,
    { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
    { destructiveHint: true },
    async ({ date }) => {
      await client.deleteWeightEntry(date);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'deleted', date }, null, 2) }] };
    }
  );
}
