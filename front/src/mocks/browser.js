// Worker MSW pour le DEV navigateur (intercepte fetch via le Service Worker public/mockServiceWorker.js).
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers.js";

export const worker = setupWorker(...handlers);
