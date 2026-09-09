export default {
  routes: [
    {
      method: "GET",
      path: "/media-tags",
      handler: "media-tag.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/media-tags",
      handler: "media-tag.createOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
