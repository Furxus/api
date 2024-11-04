import "dotenv/config";
import { App } from "./App";
import { MeController } from "./controllers/me.controller";
import { AuthController } from "./controllers/auth.controller";
import { MainController } from "./controllers/index.controller";

const app = new App([
    new AuthController(),
    new MainController(),
    new MeController()
]);

app.start();
