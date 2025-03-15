import express from "express";

const app = express();
const port = 3001;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/healthz", (req, res) => {
  res.send("OK");
});

app.listen(port, () => {
  console.log(`Server is listening on ${port}`);
});
