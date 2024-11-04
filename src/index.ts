import "dotenv/config";
import { App } from "./App";
import { MeController } from "./controllers/me.controller";
import { AuthController } from "./controllers/auth.controller";

const app = new App([new AuthController(), new MeController()]);

app.start();
