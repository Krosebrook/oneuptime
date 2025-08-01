import { PORT } from "./Config";
import AliveJob from "./Jobs/Alive";
import FetchMonitorList from "./Jobs/Monitor/FetchList";
import FetchMonitorTestList from "./Jobs/Monitor/FetchMonitorTest";
import Register from "./Services/Register";
import MetricsAPI from "./API/Metrics";
import { PromiseVoidFunction } from "Common/Types/FunctionTypes";
import logger from "Common/Server/Utils/Logger";
import App from "Common/Server/Utils/StartServer";
import Telemetry from "Common/Server/Utils/Telemetry";
import Express, { ExpressApplication } from "Common/Server/Utils/Express";
import "ejs";

const APP_NAME: string = "probe";

const init: PromiseVoidFunction = async (): Promise<void> => {
  try {
    // Initialize telemetry
    Telemetry.init({
      serviceName: APP_NAME,
    });

    // init the app
    await App.init({
      appName: APP_NAME,
      port: PORT, // some random port to start the server. Since this is the probe, it doesn't need to be exposed.
      isFrontendApp: false,
      statusOptions: {
        liveCheck: async () => {},
        readyCheck: async () => {},
      },
    });

    // Add metrics API routes
    const app: ExpressApplication = Express.getExpressApp();
    app.use("/metrics", MetricsAPI);

    // add default routes
    await App.addDefaultRoutes();

    try {
      // Register this probe.
      await Register.registerProbe();

      logger.debug("Probe registered");

      AliveJob();
      FetchMonitorList();
      FetchMonitorTestList();

      await Register.reportIfOffline();
    } catch (err) {
      logger.error("Register probe failed");
      logger.error(err);
      throw err;
    }
  } catch (err) {
    logger.error("App Init Failed:");
    logger.error(err);
    throw err;
  }
};

init().catch((err: Error) => {
  logger.error(err);
  logger.error("Exiting node process");
  process.exit(1);
});
