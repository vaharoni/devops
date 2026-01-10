This application allows running commands at a certain schedule via k8s cron jobs.
Currently only curl is supported. A special auth token is injected to the Authorization Bearer which can
be verified by the receiver.

## Adding a cron job

To add a cron job, add an entry in `package.json` under `deployments.cronJobs`:
```json
  "deployment": {
    "template": "cron-job",
    "cronJobs": [
      {
        "name": "call-check-something-in-example",
        "cron": "*/15 * * * *",
        "curl": ["jobs", "-X", "POST", "http://example/jobs/check-something"]
      }
    ]
  }  
```

- `name` - must be unique across jobs and a valid k8s name. No spaces are allowed. 
- `cron` - must be a valid Cron format per [here](https://en.wikipedia.org/wiki/Cron).
- `curl` - must be an array of strings, where each arg is an element in the array. 

A few things to note about the `curl` argument:
- We use an array here, since curl relies heavily on args with spaces, e.g. `Content-Type: application/json` is a single arg. 
- The first element must be the subject of the token sent to the endpoint. The endpoint should verify the request header contains a bearer token with the expected subject.
- The endpoint can be a DNS internal to the cluster, i.e. simply use the service name if it is in the same namepsace.

Downsides of this approach:
- the domain name used is a duplication of the `deployment.service_name` of the target application. This can be addressed in the future, e.g. by adding another arg to the cronjob with the `appName` that performs service discovery.

## Securing an API endpoint

Next.js example:

```typescript
// app/someroute/route.ts

import { NextResponse } from 'next/server';
import { InternalToken } from '@vaharoni/devops';

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('Authorization');
  try {
    new InternalToken('jobs').verifyFromHeaderOrThrow(authorizationHeader);
  } catch {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  // Do something

  return NextResponse.json({ status: 'ok' });
}
```

## Testing a secure endpoint in local development

Make sure your `config/.env.global` has something like the following. This represents hex of 32 bytes. When creating a namespace, devops properly set these for you in a k8s secret. Locally, something like this suffices.
```text
MONOREPO_BASE_SECRET=0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff
```

Then run:

```bash
devops internal-curl jobs -v -X POST localhost:3001/jobs/someroute
```
