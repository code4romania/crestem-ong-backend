import type { Core } from "@strapi/strapi";

export default ({ env }) => {
  // Virtual-hosted bucket URL, e.g. crestem-ong-staging.s3.eu-central-1.amazonaws.com.
  // Derived rather than configured so it cannot drift from the bucket the upload
  // provider actually writes to. Without it in the CSP the admin media library
  // renders blank thumbnails. A CDN or custom domain would need it back as an env.
  const bucket = env("AWS_BUCKET", "");
  const region = env("AWS_REGION", "");
  const s3Host = bucket && region ? `${bucket}.s3.${region}.amazonaws.com` : "";
  const mediaSrc = ["'self'", "data:", "blob:", ...(s3Host ? [s3Host] : [])];

  const config: Core.Config.Middlewares = [
    "strapi::logger",
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:"],
            "img-src": [...mediaSrc, "market-assets.strapi.io"],
            "media-src": mediaSrc,
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    "strapi::cors",
    "strapi::poweredBy",
    "strapi::query",
    {
      name: "strapi::body",
      config: {
        jsonLimit: "10mb",
      },
    },
    "strapi::session",
    "strapi::favicon",
    "strapi::public",
  ];

  return config;
};
