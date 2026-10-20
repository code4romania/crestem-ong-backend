export default {
  routes: [
    {
      method: "GET",
      path: "/ongs",
      handler: "ong.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      // Listed before `/ongs/:documentId` (02-detail) so "export" is not read as an id.
      method: "GET",
      path: "/ongs/export",
      handler: "ong.listExport",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
