import { Router, type IRouter } from "express";
import {
  AnalyzeCascadeBody,
  AnalyzeCascadeResponse,
  GetNepalScenarioResponse,
} from "@workspace/api-zod";
import {
  analyzeCascade,
  getNepalScenario,
} from "../lib/cascadeguard";

const router: IRouter = Router();

router.get("/scenario/nepal", (_req, res): void => {
  res.json(GetNepalScenarioResponse.parse(getNepalScenario()));
});

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeCascadeBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid cascade analysis request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!Number.isInteger(parsed.data.maxSteps)) {
    res.status(400).json({ error: "maxSteps must be a whole number" });
    return;
  }

  const result = await analyzeCascade(
    parsed.data.goal,
    parsed.data.mode,
    parsed.data.maxSteps,
  );
  res.json(AnalyzeCascadeResponse.parse(result));
});

export default router;