export default {
  routes: [
    {
      method: "POST",
      path: "/contacts",
      handler: "contact.submit",
      config: {
        auth: false,
        // Fără rate limit: bucket-ul cheie pe email, iar aici emailul e input
        // nesupravegheat al vizitatorului, nu un identificator de cont — se
        // rotește gratis. Honeypot-ul din controller e singurul control anti-spam.
      },
    },
  ],
};
