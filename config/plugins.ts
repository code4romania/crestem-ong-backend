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
      provider: "amazon-ses",
      providerOptions: {
        region: env("AWS_REGION", "eu-central-1"),
        credentials: {
          accessKeyId: env("AWS_ACCESS_KEY"),
          secretAccessKey: env("AWS_ACCESS_SECRET"),
        },
      },
      settings: {
        defaultFrom: env("EMAIL_FROM"),
        defaultReplyTo: env("EMAIL_REPLY_TO"),
      },
    },
  },
  /**
   * S3 when a bucket is configured, Strapi's local provider otherwise. Without
   * the fallback an unset `AWS_BUCKET` only surfaces at the moment someone
   * uploads, as an unhandled `No value provided for input HTTP label: Bucket`
   * that takes the whole server down — so a machine with no AWS credentials
   * writes to `public/uploads` and keeps working.
   */
  upload: {
    config: env("AWS_BUCKET")
      ? {
          provider: "aws-s3",
          providerOptions: {
            s3Options: {
              credentials: {
                accessKeyId: env("AWS_ACCESS_KEY"),
                secretAccessKey: env("AWS_ACCESS_SECRET"),
              },
              region: env("AWS_REGION"),
              params: {
                ACL: env("AWS_ACL", "private"),
                Bucket: env("AWS_BUCKET"),
              },
            },
          },
          actionOptions: {
            upload: {},
            uploadStream: {},
            delete: {},
          },
        }
      : {},
  },
});
