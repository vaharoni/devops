# How to setup the cluster infrastructure

First, create a free Cloudflare account, and have 2 domains managed by it - one for production and one for staging. You don't need to transfer the domain, just set up the name servers to Cloudflare per its instructions. Cloudflare is great for a few reasons:

1. It automatically handles TLS certificates and terminates the TLS connection
2. Its proxying capabilities allows setting up email verification for the staging domain and important production apps deployed on the cluster ("Zero Trust")

Then, you'll need to create a cluster on a hosting provider. Refer to the [Digital Ocean instrutions](DigitalOcean.md) or the [Hetzner instructions](Hetzner.md) to build the basic infrastructure and upload the appropriate github secrets.

As evident by the length of the instructions, Digital Ocean is much easier to setup. But Hetzner is much cheaper. For example, as of this writing, a cluster with 1 master node and 2 worker nodes using shared CX32 instance type on Hetzner (4 vCPUs, 8GB RAM, 80GB SSD per instance) cost about 20 EUR/month. On Digital Ocean, the control plane (master node) is free, but 2 equivalent worker nodes (though with double the storage) cost about 100 USD/month. Moreover, the k3s setup of Hetzner cluster is relatively lean compared to Digital Ocean's cluster setup, saving about 300MB of RAM overhead per worker node just for basic cluster operations (1GB overhead on Digital Ocean vs. 700MB on Hetzner). True, one master node is not high availability as Digital Ocean's control plane. But this can be addressed on Hetzner for relatitvely cheap (additional 14 EUR/month for 2 extra master nodes). The variable cost difference of worker nodes will translate to savings as your projects scale, so it may be worth taking the time to invest in such a setup early on.

Once you are done with the basic cluster creation, continue with:
- [Finalizing the cluster setup](FinalizeClusterSetup.md)
- [Installing Postgres](Postgres.md)
- [Installing Redis](Redis.md)
- [Installing Prefect](Prefect.md)
- [Installing Milvus](Milvus.md)
