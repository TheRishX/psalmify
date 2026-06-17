let app: any = null;
let bootError: any = null;

async function bootstrap() {
  if (app || bootError) return;
  try {
    const module = await import("../server");
    app = module.app || module.default;
  } catch (err: any) {
    bootError = err;
    console.error("Vercel Serverless Boot Exception:", err);
  }
}

export default async function handler(req: any, res: any) {
  await bootstrap();
  
  if (bootError) {
    res.status(500).json({
      success: false,
      error: "Vercel Boot Exception",
      message: bootError.message || String(bootError),
      stack: bootError.stack,
      hint: "Your server.ts model encountered a compilation or execution crash inside the Vercel container during loading. Inspect the stack trace below to resolve the issue."
    });
    return;
  }
  
  if (!app) {
    res.status(500).json({
      success: false,
      error: "Express Application Instantiation Failure",
      hint: "The Express app was not exported or initialized correctly from server.ts"
    });
    return;
  }
  
  return app(req, res);
}
