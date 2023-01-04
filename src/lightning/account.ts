import express from "express";
import DiscordOauth2 from "discord-oauth2";
import prisma from "../prisma.js";
import { config } from "dotenv";
config();

const router = express.Router();
const oauth = new DiscordOauth2();

router.post("/", async (req, res) => {
  const token = await oauth.tokenRequest({
    code: req.body.token as string,
    clientId: process.env.OAUTH_ID,
    clientSecret: process.env.OAUTH_SECRET,
    scope: "identify email guilds.join",
    grantType: "authorization_code",
    redirectUri: req.body.prod
      ? "https://aionary.com/lightning/login"
      : "http://localhost:5173/lightning/login",
  });

  const user = await oauth.getUser(token.access_token);
  const isUser = await prisma.user.findUnique({
    where: { discord_id: user.id },
  });

  if (isUser) {
    await prisma.user.update({
      where: { discord_id: user.id },
      data: {
        refresh_token: token.refresh_token,
        discord_username: user.username,
        name: user.username.replace(/\W/g, ""),
        email: user.email!,
        discrminator: parseInt(user.discriminator),
      },
    });
  } else {
    if (!user.verified) {
      return res.send({ error: true, msg: "Account not verified" });
    }

    oauth.addMember({
      accessToken: token.access_token,
      userId: user.id,
      guildId: "1046491437572833371",
      botToken: process.env.BOT_TOKEN as string,
    });

    await prisma.user.create({
      data: {
        email: user.email!,
        discord_id: user.id,
        discord_username: user.username,
        name: user.username.replace(/\W/g, ""),
        discrminator: parseInt(user.discriminator),
        points: 0,
        refresh_token: token.refresh_token,
      },
    });
  }

  res.send({ error: false, token: token.access_token });
});

export default router;
