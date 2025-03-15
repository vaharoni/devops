The hiearchy:

- AbstractGenerator implements the generate() method. Only relies on MONOREPO_ENV
  - EnvSetupGenerator
  - ImageConfigMapGenerator does not require SHA
  - AbstractImageGenerator main entry point for image-dependent generation. Includes the SHA
    - BuildJobGenerator
    - DbMigrateGenerator
    - BaseDeploymentGenerator this is also a concrete class, even though it is used as a base
      - CronGenerator
      - NextJsSiteGenerator
