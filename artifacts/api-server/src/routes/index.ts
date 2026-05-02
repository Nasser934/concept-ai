import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import notificationsRouter from "./notifications";
import commentsRouter from "./comments";
import profilesRouter from "./profiles";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(notificationsRouter);
router.use(commentsRouter);
router.use(profilesRouter);
router.use(aiRouter);

export default router;
