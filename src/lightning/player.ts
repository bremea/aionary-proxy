import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.get("/:name", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { name: req.params.name },
  });

  if (user) {
    res.send({
      error: false,
      player: { name: user.name, points: user.points.toString(), id: user.id },
    });
  } else {
    res.send({ error: true, msg: "Player doesn't exist!" });
  }
});

export default router;
