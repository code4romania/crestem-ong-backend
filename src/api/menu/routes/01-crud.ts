export default {
  routes: [
    // Public: the site's header and footer render for logged-out visitors.
    {
      method: "GET",
      path: "/menus",
      handler: "menu.list",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/menus/:location",
      handler: "menu.detail",
      config: { auth: false },
    },
    // No POST and no DELETE: the two menus are seeded and cannot be created or
    // destroyed through the API, only re-filled.
    {
      method: "PUT",
      path: "/menus/:location",
      handler: "menu.updateItems",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
