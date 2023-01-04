import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const lb = await prisma.user.findMany({
    orderBy: { points: "desc" },
    select: { name: true, points: true },
    take: 100,
  });

  for (let i = 0; i < lb.length; i++) {
    lb[i] = JSON.parse(
      JSON.stringify(lb[i], (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
  }

  res.send({ error: false, lb: lb });
});

export default router;
