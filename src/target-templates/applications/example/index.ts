import express from "express";
import { InternalToken } from '@vaharoni/devops';

const app = express();
const port = 3001;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// See applications/jobs/README.md for more information
app.post("/ping-from-jobs", (req, res) => {
  const authorizationHeader = req.headers['authorization'];
  try {
    new InternalToken('jobs').verifyFromHeaderOrThrow(authorizationHeader);
  } catch {
    res.status(401).json({ status: 'unauthorized' });
    return;
  }
  console.log('Pong');
  res.json({ status: 'ok' });
});

app.get("/healthz", (req, res) => {
  res.send("OK");
});

app.listen(port, () => {
  console.log(`Server is listening on ${port}`);
});
