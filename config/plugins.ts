export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: env("JWT_EXPIRES_IN", "15m"),
      },
    },
  },
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: env("SMTP_HOST", "localhost"),
        port: env.int("SMTP_PORT", 1025),
        secure: false,
        ignoreTLS: true,
        // Authenticate only when credentials are present. Mailpit (local dev)
        // accepts unauthenticated mail and rejects an AUTH handshake, so the
        // `auth` block must be absent rather than empty.
        ...(env("SMTP_USERNAME")
          ? {
              auth: {
                user: env("SMTP_USERNAME"),
                pass: env("SMTP_PASSWORD"),
              },
            }
          : {}),
      },
      settings: {
        defaultFrom: env("EMAIL_FROM"),
        defaultReplyTo: env("EMAIL_REPLY_TO"),
      },
    },
  },
});
