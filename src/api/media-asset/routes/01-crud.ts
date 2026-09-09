const staff = { policies: ["global::is-fdsc-staff"] };

export default {
  routes: [
    { method: "GET", path: "/media-assets", handler: "media-asset.list", config: staff },
    { method: "POST", path: "/media-assets/cleanup-orphan-file", handler: "media-asset.cleanupOrphanFile", config: staff },
    { method: "GET", path: "/media-assets/:documentId", handler: "media-asset.detail", config: staff },
    { method: "POST", path: "/media-assets", handler: "media-asset.createOne", config: staff },
    { method: "PUT", path: "/media-assets/:documentId", handler: "media-asset.updateOne", config: staff },
    { method: "DELETE", path: "/media-assets/:documentId", handler: "media-asset.deleteOne", config: staff },
    { method: "POST", path: "/media-assets/:documentId/replace", handler: "media-asset.replaceFile", config: staff },
  ],
};
