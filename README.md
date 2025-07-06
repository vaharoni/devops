# devops for Monorepos

Monorepos support multiple apps, allowing them to reuse functionality through shared libraries. `devops` is a tool that helps deploy and manage such setup on a kubernetes cluster using github actions. 

`devops` is...
- **a generator** - it generates boilerplate code when starting a new monorepo, such as github actions and docker images
- **a CLI** - making it easy to manage your local and remote env variables, connect to your remote databases, or launch remote console
- **a builder** - identifies which folders need to reside in which docker image through dependency discovery
- **a gitops deployer** - sets up github actions to watch pushes to `staging` and `production` branches, identifies which images are affected by those commits, and determines whether to run db migrations
- **an SDK** - helps with inter-application communication, by addressing the minor differences between local and remote environments in the DNS of endpoints, and by issuing tokens so that apps can validate traffic originated from within the cluster
- **a scheduler** - leverages kubernetes to execute curl commands to your endpoints at a certain cron schedule to trigger some background processes
- **a set of instructions** - for how to install kubernetes clusters from scratch with support for multi environments, postgres, and redis

# Documentation

- [Repo setup](./docs/RepoSetup.md)
- [Working with Python](./docs/WorkingWithPython.md)
- [Day to day work](./docs/DayToDay.md)
- [The devops architecture](./docs/Architecture.md)

# Contributing

Run this in your local copy of the devops folder:
```shell
bun link
```

Run this in a local package using the project for testing:
```shell
bun link @vaharoni/devops
bun run build
```

When done:
```shell
# In the local copy of this repo
bun unlink
```

To release:
```shell
npm version patch
git push --tags
gh release create vX.Y.Z
```