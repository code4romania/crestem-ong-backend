import type { InviteImportedOptions } from "../validation/invite-imported";

const USER_UID = "plugin::users-permissions.user";

export type InviteImportedFailure = { email: string; error: string };

export type InviteImportedRecipient = {
  id: number;
  email: string;
  nume: string;
  ongName: string;
};

export type InviteImportedResult = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  // Id of the last account in this call; pass it as `afterId` to the next.
  lastId: number | null;
  failures: InviteImportedFailure[];
  recipients?: InviteImportedRecipient[];
};

export type InviteImportedDeps = {
  buildLink: () => string;
  sendEmail: (args: {
    to: string;
    nume: string;
    ongName: string;
    link: string;
  }) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function ongNameOf(user: any): string {
  return (user.ong ?? [])[0]?.name ?? "";
}

/**
 * One-time notice run for the organization administrators carried over from
 * the old platform. The accounts are imported already active, with their old
 * password hash, so the mail is purely informative and nothing is written back.
 *
 * With no marker on the account, tranches are driven by an id cursor: each
 * call returns `lastId`, and the next one passes it as `afterId`. Addresses
 * that failed are retried through `emails`.
 */
export async function inviteImportedAdmins(
  strapi: any,
  options: InviteImportedOptions,
  deps: InviteImportedDeps,
): Promise<InviteImportedResult> {
  const sleep = deps.sleep ?? wait;

  const where: Record<string, unknown> = {
    accountStatus: "active",
    role: { type: "ngo-admin" },
  };
  if (options.afterId !== undefined) {
    where.id = { $gt: options.afterId };
  }

  const candidates: any[] = await strapi.db.query(USER_UID).findMany({
    where,
    orderBy: { id: "asc" },
    populate: ["ong"],
  });

  // Filtered here rather than through `$in`: Postgres compares strings
  // case-sensitively and the legacy export carries mixed-case addresses.
  let selected = candidates;
  let skipped = 0;
  if (options.emails) {
    const wanted = new Set(options.emails);
    selected = candidates.filter((user) =>
      wanted.has(String(user.email).toLowerCase()),
    );
    skipped = options.emails.length - selected.length;
  }

  if (options.limit !== undefined) {
    selected = selected.slice(0, options.limit);
  }

  const result: InviteImportedResult = {
    total: selected.length,
    sent: 0,
    failed: 0,
    skipped,
    dryRun: options.dryRun,
    lastId: selected.length > 0 ? selected[selected.length - 1].id : null,
    failures: [],
  };

  if (options.dryRun) {
    result.recipients = selected.map((user) => ({
      id: user.id,
      email: user.email,
      nume: user.nume,
      ongName: ongNameOf(user),
    }));
    return result;
  }

  const batches = chunk(selected, options.batchSize);
  const link = deps.buildLink();

  for (const [index, batch] of batches.entries()) {
    await Promise.all(
      batch.map(async (user) => {
        try {
          await deps.sendEmail({
            to: user.email,
            nume: user.nume,
            ongName: ongNameOf(user),
            link,
          });
          result.sent++;
        } catch (error) {
          result.failed++;
          result.failures.push({
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    if (index < batches.length - 1 && options.batchDelayMs > 0) {
      await sleep(options.batchDelayMs);
    }
  }

  return result;
}
