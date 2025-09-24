import { schedulerService } from "~/lib/scheduler.server";

// Initialize scheduler immediately when this module is imported
console.log("🚀 Initializing server modules...");
schedulerService.init();
console.log("✅ Server modules initialized");

export {};