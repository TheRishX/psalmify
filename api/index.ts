import serverModule from "../dist/server.cjs";

const app = serverModule.app || serverModule.default || serverModule;

export default app;
