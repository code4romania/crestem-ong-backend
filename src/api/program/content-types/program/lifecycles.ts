import {
  computeProgramStatus,
  toDateString,
  todayInBucharest,
} from '../../utils/status';

export default {
  beforeCreate(event: any) {
    const { data } = event.params;
    if (data.startDate && data.endDate) {
      data.programStatus = computeProgramStatus(
        toDateString(data.startDate),
        toDateString(data.endDate),
        todayInBucharest(),
      );
    }
  },
  async beforeUpdate(event: any) {
    const { data, where } = event.params;
    if (data.startDate === undefined && data.endDate === undefined) {
      return;
    }
    let startDate = data.startDate;
    let endDate = data.endDate;
    if (startDate === undefined || endDate === undefined) {
      const existing = await strapi.db
        .query('api::program.program')
        .findOne({ where });
      if (!existing) {
        return;
      }
      startDate = startDate ?? existing.startDate;
      endDate = endDate ?? existing.endDate;
    }
    if (startDate && endDate) {
      data.programStatus = computeProgramStatus(
        toDateString(startDate),
        toDateString(endDate),
        todayInBucharest(),
      );
    }
  },
};
