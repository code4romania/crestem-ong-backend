import { belongsToOng, loadUserWithOngs } from "../../../utils/ong-scope";
import { isFdscStaff } from "../../../utils/fdsc-staff";

const ONG_UID = "api::ong.ong";

/**
 * The single rejection an `ngo-admin` ever gets for an organization that is not
 * theirs — whether it exists or not. See `decideOngDeletion`.
 */
export const ONG_NOT_FOUND_MESSAGE = "Organizația nu există";
export const ONG_ALREADY_DELETED_MESSAGE = "Organizația este deja ștearsă";
export const ONG_DELETE_FORBIDDEN_MESSAGE =
  "Nu ai dreptul să ștergi această organizație";

/**
 * `outcome` is a string rather than an `allowed: boolean` flag because this
 * project compiles with `strict: false`, under which TypeScript will not narrow
 * a union on a boolean-literal discriminant.
 */
export type OngDeletionDecision =
  | { outcome: "allowed" }
  | {
      outcome: "denied";
      status: "forbidden" | "badRequest";
      message: string;
    };

export interface OngDeletionFacts {
  /** `ctx.state.user.role?.type` — never anything the client sent. */
  roleType?: string | null;
  /**
   * Whether the acting user's memberships, as loaded from the database, contain
   * the organization named by the route parameter. Meaningless for
   * `super-admin`, who is not scoped to an organization.
   */
  ownsTarget: boolean;
  targetExists: boolean;
  targetDeleted: boolean;
}

/**
 * Who may run `Șterge ONG`, as a pure function of server-loaded facts.
 *
 * - FDSC staff (`super-admin`, `editor-fdsc`) may delete any organization.
 * - `ngo-admin` may delete only an organization they themselves belong to
 *   ("Business rules.txt": the option lives in the Admin ONG's own Acțiuni
 *   menu, with no approval step). BR-32 otherwise dead-ends them: they cannot
 *   delete their account until the organization is gone.
 * - Everybody else is refused. The route policy already refuses them, so this
 *   branch is defence in depth rather than the primary gate.
 *
 * ## Why "not mine" and "does not exist" return the identical value
 *
 * An `ngo-admin` can address any `documentId` they can guess or read from a
 * shared link. If "not yours" and "no such organization" answered differently —
 * different status, different wording, or one of them reaching a later check —
 * the endpoint would confirm which organization ids exist, for anybody holding
 * an ngo-admin account.
 *
 * Two things make that impossible here:
 *
 * 1. The ownership test is evaluated **before** `targetExists`, and both produce
 *    the same `{ outcome: "denied", status: "badRequest", message:
 *    ONG_NOT_FOUND_MESSAGE }` object. An `ngo-admin` who does not belong to the
 *    target never reaches the existence branch, the already-deleted branch, or
 *    the deletion itself, so no later check can differentiate the two cases.
 * 2. `ownsTarget` is false whenever the organization does not exist — nobody
 *    holds a membership in a row that is not there — so the two cases are not
 *    merely answered alike, they are literally the same branch.
 *
 * The caller (`authorizeOngDeletion`) performs the same database reads in both
 * cases, so the work done before the rejection does not differ either.
 */
export function decideOngDeletion(facts: OngDeletionFacts): OngDeletionDecision {
  const { roleType, ownsTarget, targetExists, targetDeleted } = facts;
  const isStaff = isFdscStaff(roleType);
  const isNgoAdmin = roleType === "ngo-admin";

  if (!isStaff && !isNgoAdmin) {
    return {
      outcome: "denied",
      status: "forbidden",
      message: ONG_DELETE_FORBIDDEN_MESSAGE,
    };
  }
  if (isNgoAdmin && !ownsTarget) {
    return {
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    };
  }
  if (!targetExists) {
    return {
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    };
  }
  if (targetDeleted) {
    return {
      outcome: "denied",
      status: "badRequest",
      message: ONG_ALREADY_DELETED_MESSAGE,
    };
  }
  return { outcome: "allowed" };
}

/**
 * Loads the facts `decideOngDeletion` needs, straight from the database.
 *
 * The signature deliberately takes three scalars instead of the Koa context:
 * this function has no way to read a request body, a query string or a header,
 * so no organization id from the client can reach the ownership comparison. The
 * caller must pass `ctx.params.documentId` (the route path) and
 * `ctx.state.user`'s own `documentId` / `role.type`, both established by the
 * authentication layer.
 *
 * For an `ngo-admin` the organization lookup and the membership lookup both run
 * regardless of the outcome, so "not mine" and "does not exist" issue the same
 * queries in the same order before returning the same rejection.
 */
export async function authorizeOngDeletion(
  strapi: any,
  input: {
    actorDocumentId: string;
    roleType?: string | null;
    targetDocumentId: string;
  },
): Promise<OngDeletionDecision> {
  const { actorDocumentId, roleType, targetDocumentId } = input;
  const isStaff = isFdscStaff(roleType);
  const isNgoAdmin = roleType === "ngo-admin";

  if (!isStaff && !isNgoAdmin) {
    // Refused on the role alone: no lookup is performed, so an unrelated role
    // cannot use this endpoint to probe anything at all.
    return decideOngDeletion({
      roleType,
      ownsTarget: false,
      targetExists: false,
      targetDeleted: false,
    });
  }

  const target = await strapi.documents(ONG_UID).findOne({
    documentId: targetDocumentId,
  });
  const ownsTarget = isNgoAdmin
    ? belongsToOng(
        await loadUserWithOngs(strapi, actorDocumentId),
        targetDocumentId,
      )
    : false;

  return decideOngDeletion({
    roleType,
    ownsTarget,
    targetExists: Boolean(target),
    targetDeleted: target?.ngoStatus === "deleted",
  });
}
