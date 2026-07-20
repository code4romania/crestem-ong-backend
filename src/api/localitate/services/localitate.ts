/**
 * localitate service
 */

import { factories } from "@strapi/strapi";

export interface LocalitateService {
  /**
   * Check whether a localitate (city) belongs to a given judet (county).
   *
   * @param cityId - documentId of the localitate
   * @param countyId - documentId of the judet it should belong to
   * @returns `true` only if the localitate exists and its judet matches `countyId`.
   */
  checkCityBelongsToCounty(cityId: string, countyId: string): Promise<boolean>;
}

export default factories.createCoreService(
  "api::localitate.localitate",
  ({ strapi }) => ({
    /**
     * Check whether a localitate (city) belongs to a given judet (county).
     *
     * @param cityId - documentId of the localitate
     * @param countyId - documentId of the judet it should belong to
     * @returns `true` only if the localitate exists and its judet matches `countyId`.
     */
    async checkCityBelongsToCounty(
      cityId: string,
      countyId: string,
    ): Promise<boolean> {
      if (!cityId || !countyId) return false;

      try {
        const city = await strapi.db
          .query("api::localitate.localitate")
          .findOne({
            where: { documentId: cityId },
            populate: { judet: true },
          });

        return city?.judet?.documentId === countyId;
      } catch (error) {
        strapi.log.error("checkCityBelongsToCounty failed", error);
        return false;
      }
    },
  }),
);
