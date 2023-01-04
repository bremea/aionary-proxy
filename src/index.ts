import * as http from "http";
import express from "express";
import httpProxy from "http-proxy";
import redis from "./redis.js";
import centra from "centra";
import cors from "cors";
import accountRouter from "./lightning/account.js";
import playerRouter from "./lightning/player.js";
import meRouter from "./lightning/me.js";
import lbRouter from "./lightning/lb.js";

const proxy = httpProxy.createProxyServer({
  ws: true,
  target: "http://_api.internal:4280",
});
const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

const server = http.createServer(app);

server.on("upgrade", (req, socket) => {
  const mId = req.url.replace("/", "");
  try {
    proxy.ws(req, socket, {
      target: `ws://${mId}.vm.aionary-gamews.internal:8080`,
    });
  } catch (e) {
    socket.end();
  }
});

app.post("/v1/*", (req, res) => {
  proxy.web(req, res);
});

app.get("/v1/*", (req, res) => {
  proxy.web(req, res);
});

const newPub = async (special: boolean): Promise<string> => {
  const flyreq = centra(
    "http://_api.internal:4280/v1/apps/aionary-gamews/machines",
    "POST"
  );
  flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
  flyreq.header("Content-Type", "application/json");
  flyreq.body(
    {
      config: {
        image: "registry.fly.io/aionary-gamews:latest",
        env: {
          PUBLIC_GAME: "true",
          SPECIAL: special ? "true" : "false",
        },
        services: [
          {
            ports: [
              {
                port: 80,
                handlers: ["http"],
              },
            ],
            protocol: "tcp",
            internal_port: 8080,
          },
        ],
      },
    },
    "json"
  );
  const flyres = await flyreq.send();
  const flyjson = await flyres.json();
  return flyjson["id"];
};

app.post("/kms/:id", async (req, res) => {
  await kill(req.params.id);
  res.send("OK");
});

const kill = async (id: string) => {
  let flyreq = centra(
    `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${id}/stop`,
    "POST"
  );
  flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
  flyreq.header("Content-Type", "application/json");
  const sentreq = await flyreq.send();
  const res = await sentreq.json();
  const instid = res.instance_id;

  flyreq = centra(
    `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${id}/stop`,
    "POST"
  );
  flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
  flyreq.header("Content-Type", "application/json");
  await flyreq.send();

  flyreq = centra(
    `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${id}/wait?timeout=120&state=stopped&instance_id=${instid}`,
    "GET"
  );
  flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
  flyreq.header("Content-Type", "application/json");
  const rr = await flyreq.send();
  console.log(await rr.text());

  flyreq = centra(
    `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${id}`,
    "DELETE"
  );
  flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
  flyreq.header("Content-Type", "application/json");
  const rres = await flyreq.send();
  return rres;
};

app.get("/players", async (req, res) => {
  const keys = await redis.keys("*:players");
  let total = 0;
  for (const key of keys) {
    total += await redis.hlen(key);
  }
  res.send(total.toString());
});

app.get("/pub", async (req, res) => {
  const isSpecial = Object.keys(req.query).includes("special");

  const vals: { [key: string]: string } = await redis.hgetall(
    isSpecial ? "needPlayers:special" : "needPlayers:classic"
  );
  const valSort = Object.keys(vals).sort(
    (a, b) => parseInt(vals[a]) - parseInt(vals[b])
  );

  let instanceIsClear = false;

  do {
    if (valSort.length === 0) {
      instanceIsClear = true;
    } else {
      let flyreq = centra(
        `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${valSort[0]}`,
        "GET"
      );
      flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
      flyreq.header("Content-Type", "application/json");
      const sreq = await flyreq.send();
      const rres = await sreq.json();

      if (
        rres.state === "stopped" ||
        rres.state === "stopping" ||
        rres.state === "destroyed" ||
        rres.error
      ) {
        redis.hdel(
          isSpecial ? "needPlayers:special" : "needPlayers:classic",
          valSort.shift()
        );
      } else {
        instanceIsClear = true;
      }
    }
  } while (!instanceIsClear);

  if (valSort.length == 0) {
    const ns = await newPub(isSpecial);
    const flyreq = centra(
      `http://_api.internal:4280/v1/apps/aionary-gamews/machines/${ns}/wait?state=started&timeout=120`,
      "GET"
    );
    flyreq.header("Authorization", `Bearer ${process.env.FLY_API_TOKEN}`);
    flyreq.header("Content-Type", "application/json");
    await flyreq.send();
    res.send(ns);
  } else {
    res.send(valSort[0]);
  }
});

app.use("/lightning/account", accountRouter);
app.use("/lightning/player", playerRouter);
app.use("/lightning/me", meRouter);
app.use("/lightning/lb", lbRouter);

console.log("Running Proxy");
server.listen(8080);
