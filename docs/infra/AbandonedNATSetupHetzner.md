# Do not use!

This approach failed. Running `hetzner-k3s create` ended with the error:

```text
[Control plane] Generating the kubeconfig file to /root/hetzner/kubeconfig...
error: no context exists with the name: "changeme-master1"
[Control plane] : error: no context exists with the name: "changeme-master1"
```

When SSHing into the servers, the `k3s.yaml` file was not present under `/etc/rancher/k3s` like in typical successful installations.

Use [the typical setup](Hetzner.md) instead.

The below is a record of what was attempted. The failed `hcloud-config.yaml` used can be found [here](.devops/infra/hetzner/abandoned/hcloud-config.yaml).

# Overview

We follow the instructions in the [hetzner-k3s][1] repo. The cluster is created so that it is not publically available by [setting up a network and a NAT manually][6] and following [these instructions][7].

Create a new project in Heztner and acquire a token per the top section of [these instructions][2]. Keep the token somewhere locally that is git-ignored, e.g. under `/tmp/keys/`.

Locally, generate SSH keys:

```shell
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_hcloud
```

When prompted to add SSH keys to Hetzner, use the public key in `id_hcloud.pub`.

# Step 1: Set up a NAT Server

Start creating a CX22 server in the new project. Pick Ubuntu 24.04. During the server creation, create a new network and name it `cluster-network` (important to follow this, as it is used in the configuration file later).

Now, you will need to add a cloud init script as part of the server creation. This requires to know the name of the network interface. We assume below that the `enp7s0` network interface exists for the created server type. This can be verified by launching a temporary server of the same type and OS and running `ifconfig`. This was the output produced:

```text
enp7s0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1450
        inet 10.0.0.2  netmask 255.255.255.255  broadcast 10.0.0.2
        inet6 fe80::8400:ff:fed2:3739  prefixlen 64  scopeid 0x20<link>
        ether 86:00:00:d2:37:39  txqueuelen 1000  (Ethernet)
        RX packets 1  bytes 350 (350.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 9  bytes 998 (998.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 138.199.211.107  netmask 255.255.255.255  broadcast 0.0.0.0
        inet6 2a01:4f8:c0c:6eed::1  prefixlen 64  scopeid 0x0<global>
        inet6 fe80::9400:4ff:fe20:2a15  prefixlen 64  scopeid 0x20<link>
        ether 96:00:04:20:2a:15  txqueuelen 1000  (Ethernet)
        RX packets 138  bytes 29255 (29.2 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 110  bytes 18738 (18.7 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 84  bytes 6616 (6.6 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 84  bytes 6616 (6.6 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

The name of the private network interface above (`enp7s0`) is used when adding the following cloud init config in the appropriate input box of Hetzner:

```yaml
#cloud-config
write_files:
  - path: /etc/networkd-dispatcher/routable.d/10-eth0-post-up
    content: |
      #!/bin/bash

      echo 1 > /proc/sys/net/ipv4/ip_forward
      iptables -t nat -A POSTROUTING -s '10.0.0.0/16' -o enp7s0 -j MASQUERADE
    permissions: "0755"

runcmd:
  - reboot
```

Make sure you can SSH into the NAT server using the SSH keys generated earlier.

Separately, on the Hetzner console UI, go to the Networks tab add a route to `0.0.0.0/0` with the "gateway" being the IP of the NAT server. Ignore the warning Hetzner provides. We address it in subsequent steps.

# Step 2: Create the cluster

On the NAT server, install the `hetzner-k3s` tool by following [these instructions][2] (follow the updated instructions rather than the below):

```shell
wget https://github.com/vitobotta/hetzner-k3s/releases/download/v2.2.7/hetzner-k3s-linux-amd64
chmod +x hetzner-k3s-linux-amd64
sudo mv hetzner-k3s-linux-amd64 /usr/local/bin/hetzner-k3s
```

Create the config file:

```shell
mkdir hetzner
cd hetzner
vim hcloud-config.yaml
```

and copy the contents of the [hcloud-config.yaml][3] file. The file was created by combining [these instructions][4], this [tutorial][5], and the [NAT instructions][7].

For the `k3s_version` field, check the current avaiable k3s releases by running:

```shell
hetzner-k3s releases
```

Copy the ssh public and private key into `~/.ssh`:

```shell
vim ~/.ssh/id_hcloud
vim ~/.ssh/id_hcloud.pub
chmod 400 ~/.ssh/id_hcloud
chmod 400 ~/.ssh/id_hcloud.pub
```

Install kubectl and helm:

```shell
# Install kubectl
snap install kubectl --classic
# Verify
kubectl version --client

# Install helm
snap install helm --classic
# Verify
helm version
```

Set the `HCLOUD_TOKEN` env variable to be the token created earlier. The tool rely on this env variable. Make sure to delete the bash history with that entry:

```shell
export HCLOUD_TOKEN=<TOKEN>
history               # Find the numeric index of the export command
history -d <INDEX>    # Set the index accordingly
```

Finally, create the cluster based on the config, run the following inside the `hetzner` directory:

```shell
hetzner-k3s create --config ./hcloud-config.yaml
```

# Step 3: forward port 6443 to master node

WARNING: These instructions were not actually tested, as the command above failed. This is purely theoretical.

Note the IP address of the master node. Here it's denoted below as 10.0.X.Y. On the NAT server, edit `/etc/networkd-dispatcher/routable.d/10-eth0-post-up` with the following:

```bash
#!/bin/bash

# This should already exist as a result of the cloud init script
echo 1 > /proc/sys/net/ipv4/ip_forward
iptables -t nat -A POSTROUTING -s '10.0.0.0/16' -o enp7s0 -j MASQUERADE

# Forward Kubernetes API port 6443 to master node
iptables -t nat -A PREROUTING -i enp7s0 -p tcp --dport 6443 -j DNAT --to-destination 10.0.X.Y:6443
iptables -A FORWARD -p tcp -d 10.0.X.Y --dport 6443 -m state --state NEW,ESTABLISHED,RELATED -j ACCEPT
```

In a multi master node setup, research the use of Hetzner Floating IPs.

# Step 3: Ingress setup

Adding the Ingress controller:

```shell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install \
ingress-nginx ingress-nginx/ingress-nginx \
--set controller.ingressClassResource.default=true \
-f .devops/hetzner/ingress-nginx-annotations.yaml \
--namespace ingress-nginx \
--create-namespace
```

Update the nginx ingress configmap:

```shell
kubectl apply -f .devops/hetzner/ingress-nginx-configmap.yaml
```

Install the metrics server (based on the [instructions](https://github.com/kubernetes-sigs/metrics-server)):

```shell
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Take the IP of the loadbalancer:

```shell
kubectl get svc -n ingress-nginx
```

On Cloudflare, add a wildcard A record (e.g. `*.mydomain.com`) and point it at the external IP. This makes it easy to point any subdomain to an application using Ingress manifests with no further manual setup. You should have one production domain and one staging domain, and do this for each (creating a staging subdomain under the production one leads to issues with SSL certificates).

[1]: https://github.com/vitobotta/hetzner-k3s
[2]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Installation.md
[3]: ./hcloud-config.yaml
[4]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Creating_a_cluster.md
[5]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Setting%20up%20a%20cluster.md
[6]: https://community.hetzner.com/tutorials/how-to-set-up-nat-for-cloud-networks
[7]: https://github.com/vitobotta/hetzner-k3s/blob/main/docs/Private_clusters_with_public_network_interface_disabled.md
