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
  failures: InviteImportedFailure[];
  recipients?: InviteImportedRecipient[];
};

export type InviteImportedDeps = {
  signToken: (userId: number) => string;
  buildLink: (token: string) => string;
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
 * One-time invitation run for the organization administrators carried over
 * from the old platform.
 *
 * `resetPasswordToken` doubles as the "already invited" marker: the import
 * never writes it, and every send does, so a rerun skips whoever already has
 * one and the caller can work through ~450 accounts in tranches without
 * tracking any state between calls.
 */
export async function inviteImportedAdmins(
  strapi: any,
  options: InviteImportedOptions,
  deps: InviteImportedDeps,
): Promise<InviteImportedResult> {
  const sleep = deps.sleep ?? wait;

  const where: Record<string, unknown> = {
    accountStatus: "pending",
    role: { type: "ngo-admin" },
  };
  if (!options.force) {
    where.resetPasswordToken = { $null: true };
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

  const users = strapi.plugin("users-permissions").service("user");
  const batches = chunk(selected, options.batchSize);

  for (const [index, batch] of batches.entries()) {
    await Promise.all(
      batch.map(async (user) => {
        const token = deps.signToken(user.id);

        try {
          await users.edit(user.id, { resetPasswordToken: token });

          await deps.sendEmail({
            to: user.email,
            nume: user.nume,
            ongName: ongNameOf(user),
            link: deps.buildLink(token),
          });

          result.sent++;
        } catch (error) {
          // A token left behind would mark the account as invited and hide it
          // from the next tranche, although nothing reached the inbox.
          try {
            await users.edit(user.id, { resetPasswordToken: null });
          } catch (rollbackError) {
            console.error(
              "inviteImportedAdmins rollback failed",
              user.id,
              rollbackError,
            );
          }

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
