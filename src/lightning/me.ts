import express from "express";
import DiscordOauth2 from "discord-oauth2";
import prisma from "../prisma.js";
import { config } from "dotenv";
config();

const router = express.Router();
const oauth = new DiscordOauth2();

router.get("/", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(403).send({ error: true, msg: "Missing auth" });
  }

  try {
    const user = await oauth.getUser(token);
    const me = await prisma.user.findUnique({
      where: { discord_id: user.id },
    });
    if (me) {
      res.send({
        error: false,
        data: {
          id: me.id,
		  discriminator: me.discrminator,
          name: me.name,
		  points: me.points.toString(),
          discord_username: me.discord_username,
        },
      });
    } else {
      return res.status(403).send({ error: true, msg: "Invalid token" });
    }
  } catch (e) {
    return res.status(403).send({ error: true, msg: "Invalid token" });
  }
});

export default router;
