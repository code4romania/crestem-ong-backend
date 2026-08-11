import crypto from "crypto";
import type { Core } from "@strapi/strapi";
import LOCALITIES from "../constants/localities.json";

const JUDET_UID = "api::judet.judet";
const LOCALITATE_UID = "api::localitate.localitate";
const CHUNK_SIZE = 500;

interface CountySeed {
  nume: string;
  abreviere: string;
  localitati: string[];
}

interface JoinTableInfo {
  name: string;
  localitateColumn: string;
  judetColumn: string;
  orderColumn: string | null;
}

const COUNTIES = LOCALITIES as CountySeed[];

const DOCUMENT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const DOCUMENT_ID_LENGTH = 24;

const generateDocumentId = () => {
  const bytes = crypto.randomBytes(DOCUMENT_ID_LENGTH);
  let id = "";
  for (const byte of bytes) {
    id += DOCUMENT_ID_ALPHABET[byte % DOCUMENT_ID_ALPHABET.length];
  }
  return id;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const missingNames = (expected: string[], existing: string[]) => {
  const existingCounts = new Map<string, number>();
  for (const name of existing) {
    existingCounts.set(name, (existingCounts.get(name) ?? 0) + 1);
  }

  const missing: string[] = [];
  for (const name of expected) {
    const available = existingCounts.get(name) ?? 0;
    if (available > 0) {
      existingCounts.set(name, available - 1);
      continue;
    }
    missing.push(name);
  }

  return missing;
};

const resolveTables = (strapi: Core.Strapi) => {
  const metadata: any = strapi.db.metadata.get(LOCALITATE_UID);
  const joinTable = metadata?.attributes?.judet?.joinTable;

  if (!metadata?.tableName || !joinTable?.name) {
    throw new Error(
      "[seed] Could not resolve the localitate/judet table metadata.",
    );
  }

  const judetMetadata: any = strapi.db.metadata.get(JUDET_UID);
  const inverseJoinTable = judetMetadata?.attributes?.localitati?.joinTable;
  const inverseOrderColumn =
    inverseJoinTable?.name === joinTable.name
      ? (inverseJoinTable.orderColumnName ?? null)
      : null;

  const info: JoinTableInfo = {
    name: joinTable.name,
    localitateColumn: joinTable.joinColumn?.name ?? "localitate_id",
    judetColumn: joinTable.inverseJoinColumn?.name ?? "judet_id",
    orderColumn: joinTable.orderColumnName ?? inverseOrderColumn,
  };

  return { localitateTable: metadata.tableName as string, joinTable: info };
};

const loadExistingByJudet = async (
  strapi: Core.Strapi,
  localitateTable: string,
  joinTable: JoinTableInfo,
) => {
  const rows = await strapi.db
    .connection(localitateTable)
    .join(
      joinTable.name,
      `${joinTable.name}.${joinTable.localitateColumn}`,
      `${localitateTable}.id`,
    )
    .select(
      `${localitateTable}.nume as nume`,
      `${joinTable.name}.${joinTable.judetColumn} as judet_id`,
    );

  const byJudet = new Map<number, string[]>();
  for (const row of rows as any[]) {
    const names = byJudet.get(row.judet_id) ?? [];
    names.push(row.nume);
    byJudet.set(row.judet_id, names);
  }

  return byJudet;
};

const ensureJudet = async (strapi: Core.Strapi, county: CountySeed) => {
  const now = new Date();

  return strapi.db.query(JUDET_UID).create({
    data: {
      documentId: generateDocumentId(),
      nume: county.nume,
      abreviere: county.abreviere,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    },
  });
};

const insertLocalitati = async (
  strapi: Core.Strapi,
  judetId: number,
  names: string[],
  joinTable: JoinTableInfo,
  startOrder: number,
) => {
  let order = startOrder;

  for (const batch of chunk(names, CHUNK_SIZE)) {
    const now = new Date();
    const { ids } = await strapi.db.query(LOCALITATE_UID).createMany({
      data: batch.map((nume) => ({
        documentId: generateDocumentId(),
        nume,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      })),
    });

    const links = (ids as number[]).map((localitateId) => {
      const row: Record<string, unknown> = {
        [joinTable.localitateColumn]: localitateId,
        [joinTable.judetColumn]: judetId,
      };
      if (joinTable.orderColumn) {
        row[joinTable.orderColumn] = order;
      }
      order += 1;
      return row;
    });

    await strapi.db.connection(joinTable.name).insert(links);
  }
};

export const seedLocalities = async (strapi: Core.Strapi) => {
  const expectedLocalitati = COUNTIES.reduce(
    (total, county) => total + county.localitati.length,
    0,
  );

  const [judetCount, localitateCount] = await Promise.all([
    strapi.db.query(JUDET_UID).count(),
    strapi.db.query(LOCALITATE_UID).count(),
  ]);

  if (judetCount >= COUNTIES.length && localitateCount >= expectedLocalitati) {
    return;
  }

  const { localitateTable, joinTable } = resolveTables(strapi);

  const judete = await strapi.db.query(JUDET_UID).findMany();
  const judetByNume = new Map<string, any>(
    judete.map((judet: any) => [judet.nume, judet]),
  );
  const existingByJudet = await loadExistingByJudet(
    strapi,
    localitateTable,
    joinTable,
  );

  let createdJudete = 0;
  let createdLocalitati = 0;

  for (const county of COUNTIES) {
    let judet = judetByNume.get(county.nume);

    if (!judet) {
      judet = await ensureJudet(strapi, county);
      createdJudete += 1;
    }

    const existing = existingByJudet.get(judet.id) ?? [];
    if (existing.length === county.localitati.length) continue;

    const missing = missingNames(county.localitati, existing);
    if (missing.length === 0) continue;

    await insertLocalitati(
      strapi,
      judet.id,
      missing,
      joinTable,
      existing.length + 1,
    );

    createdLocalitati += missing.length;
  }

  if (createdJudete > 0 || createdLocalitati > 0) {
    strapi.log.info(
      `[bootstrap] Seeded ${createdJudete} judete and ${createdLocalitati} localitati.`,
    );
  }
};
