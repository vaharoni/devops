# Setting up Cloudflare

This should be done after you installed your Ingress controller and before you add any workload into the cluster (container registry in the case of Hetzner).

First, copy the External IP of your cluster's Ingress controller (it may take a few minutes to show):

```shell
kubectl get services -A -l app.kubernetes.io/name=ingress-nginx
```

On Cloudflare, add a wildcard A record (e.g. `*.mydomain.com`) and point it at the external IP. This makes it easy to point any subdomain to an application using Ingress manifests with no further manual setup. You should have one production domain and one staging domain, and do this for each (creating a staging subdomain under the production one leads to issues with SSL certificates).

To test that the ingress setup works, run the following:

```shell
# Replace test.domain.com with whatever subdomain under either your production domain or staging domain.
# It is recommended to test it once for staging and once for production.
cat .devops/infra/test.yaml | TEST_HOST=test.domain.com envsubst | kubectl apply -f -
```

Then visit that subdomain from your browser. If you get the "Hello from the first deployment!" message, you are good.

Run the following to delete the test deployment:

```shell
kubectl delete ns tmp
```

Then, go to SSL/TLS > Overview > Configure, and pick "Full". Do this for both staging and production domains. This is needed in order to avoid SSL issues with Harbor (installed on Hetzner).

# Turning on Zero Trust on Cloudflare

Zero Trust is free for up to 50 users. It can be configured to protect any subdomain that is behind the Cloudflare proxy, allowing access only to defined users, user email addresses, or token bearers (for API calls). We will use it to protect the staging domain, with the exception of the Harbor registry subdomain (if installed on Hetzner) as docker does not allow sending headers as part of push/pull requests. That exception does not need to be configured in Zero Trust per se, as the DNS records is not proxied per the Harbor setup instructions.

On Cloudflare, go to the account home (outside of any specific domain), and from there pick Zero Trust.

1. Set up who can access resources:

- If you'd like to whitelist emails from an entire domain (e.g. everyone with @somedomain.com), you can skip this step.
- Setup a manual user list like so:
  - My Team > Lists > Create manual list
  - Name it "Permitted users"
  - Add your email address (remember to click on "Add") and save

For the future, it's good to keep in mind you can also create access tokens by going to Access > Service auth and generating a token.

2. Create a policy to allow Permitted users:

- Access > Policies > Add a policy
- Name it "Permitted users"
- Pick the action "Allow"
- Here you have a few options:
  - Add a rule for "Email list" and pick the list you created in step 1
  - Add a rule for "Emails ending in" and pick the domain you want to whitelist
  - Add a rule for "Service token" and pick the IP addresses you want to whitelist

3. Create an application to capture all subdomains under staging

- Access > Applications > Add an application
- Pick "Self hosted"
- Name it based on your staging domain, e.g. "your-staging-domain.com"
- Pick Session duration of 1 week
- Click "Add public hostname"
- Put "\*" in the subdomain field and pick the staging domain. Leave the path empty.
- Click "Select existing policies" and pick "Permitted users"

Now if you visit any subdomain under your staging domain, you will be prompted to log in.

If you need to exclude a subdomain from the Zero Trust setup, you can do so by creating a bypass policy:

- Access > Policies > Add a policy
- Name it "Everyone"
- Pick the action "Bypass"

And then add an application that uses this policy and targets the subdomain you wish to exclude.