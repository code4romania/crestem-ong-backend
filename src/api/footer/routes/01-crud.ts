export default {
  routes: [
    // Public: the footer renders for logged-out visitors.
    {
      method: "GET",
      path: "/footer",
      handler: "footer.detail",
      config: { auth: false },
    },
    {
      method: "PUT",
      path: "/footer",
      handler: "footer.updateOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
