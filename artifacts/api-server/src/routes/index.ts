import { Router, type IRouter } from "express";
import cascadeguardRouter from "./cascadeguard";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cascadeguardRouter);

export default router;
