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
  upload: {
    config: {
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
    },
  },
});
