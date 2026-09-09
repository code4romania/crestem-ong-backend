const staff = { policies: ["global::is-fdsc-staff"] };

export default {
  routes: [
    { method: "GET", path: "/media-assets", handler: "media-asset.list", config: staff },
    { method: "GET", path: "/media-assets/:documentId", handler: "media-asset.detail", config: staff },
    { method: "POST", path: "/media-assets", handler: "media-asset.createOne", config: staff },
  ],
};
