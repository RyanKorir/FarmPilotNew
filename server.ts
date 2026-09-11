import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
    const app = express();
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    // API routes
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", message: "Smart Farm Assistant API is running" });
    });

    app.get("/api/weather", async (req, res) => {
      const { latitude, longitude } = req.query;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }
      
      let lastError;
      // Simple retry mechanism (3 attempts)
      for (let i = 0; i < 3; i++) {
        try {
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode&timezone=auto`;
          const response = await fetch(weatherUrl);
          
          if (response.ok) {
            const data = await response.json();
            return res.json(data);
          }
          
          lastError = new Error(`Upstream weather API returned ${response.status}`);
          if (response.status !== 502 && response.status !== 503 && response.status !== 504) {
            // If it's not a gateway/server error, don't retry
            break;
          }
          
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        } catch (error) {
          lastError = error;
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
      }

      console.error("Weather proxy error after retries:", lastError);
      res.status(502).json({ 
        error: "Failed to fetch weather data from upstream after multiple attempts",
        details: lastError instanceof Error ? lastError.message : String(lastError)
      });
    });

    // Request logging middleware to debug blank screen issue
    app.use((req, res, next) => {
      if (!req.url.startsWith('/@vite') && !req.url.startsWith('/node_modules')) {
        console.log(`[Request] ${req.method} ${req.url}`);
      }
      next();
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting server in development mode with Vite middleware...");
      try {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("Vite middleware attached.");
      } catch (viteError) {
        console.error("Failed to create Vite server:", viteError);
      }
    } else {
      console.log("Starting server in production mode...");
      const distPath = path.resolve(process.cwd(), "dist");
      console.log(`Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }

    // SPA Fallback for Development (only if not handled by Vite/Static)
    app.get("*", (req, res, next) => {
      // If it's not a file request and not handled by previous middleware
      if (!req.url.includes('.') && !req.url.startsWith('/api')) {
         console.log(`SPA fallback triggering for: ${req.url}`);
         const indexPath = process.env.NODE_ENV === 'production' 
           ? path.resolve(process.cwd(), "dist", "index.html")
           : path.resolve(process.cwd(), "index.html");
         return res.sendFile(indexPath);
      }
      next();
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Critical server startup error:", error);
    process.exit(1);
  }
}

startServer();
