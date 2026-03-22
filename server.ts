import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/ai/chat", async (req, res) => {
    const { messages, model } = req.body;
    let apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ 
        error: "OPENROUTER_API_KEY is not set in the Secrets panel." 
      });
    }

    // Clean the API key: remove whitespace, quotes, and "Bearer " prefix
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.replace('Bearer ', '').trim();
    }

    if (apiKey.length < 10) {
      return res.status(401).json({ 
        error: "The provided OPENROUTER_API_KEY seems too short or invalid." 
      });
    }

    try {
      // Use native fetch for better compatibility in this environment
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app",
          "Referer": process.env.APP_URL || "https://ais-dev.run.app",
          "X-Title": "Neurate AI",
        },
        body: JSON.stringify({
          model: model || "deepseek/deepseek-chat",
          messages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("OpenRouter Error Details:", JSON.stringify(data));
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
      res.status(500).json({ error: "Failed to connect to OpenRouter: " + error.message });
    }
  });

  app.post("/api/search", async (req, res) => {
    const { query } = req.body;
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "SerpAPI key not configured" });
    }

    try {
      const response = await axios.get("https://serpapi.com/search", {
        params: {
          q: query,
          api_key: apiKey,
          engine: "google",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Search Error:", error.message);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.post("/api/github/export", async (req, res) => {
    const { token, repoName, files } = req.body;

    if (!token) {
      return res.status(400).json({ error: "GitHub token is required" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files to export" });
    }

    try {
      // 1. Create Repository
      let createRepoRes;
      try {
        createRepoRes = await axios.post(
          "https://api.github.com/user/repos",
          { name: repoName, private: false, auto_init: true },
          { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } }
        );
      } catch (err: any) {
        if (err.response?.status === 422) {
          throw new Error("Repository name already exists or is invalid.");
        }
        throw err;
      }

      const owner = createRepoRes.data.owner.login;

      // 2. Push Files
      // We wait a bit for GitHub to initialize the repo if auto_init was true
      await new Promise(resolve => setTimeout(resolve, 2000));

      for (const file of files) {
        if (!file.content) continue;
        
        try {
          await axios.put(
            `https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}`,
            {
              message: `Add ${file.path} via Neurate AI`,
              content: Buffer.from(file.content, 'utf-8').toString("base64"),
            },
            { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } }
          );
        } catch (fileErr: any) {
          console.error(`Error pushing file ${file.path}:`, fileErr.response?.data || fileErr.message);
          // Continue with other files even if one fails
        }
      }

      res.json({ url: createRepoRes.data.html_url });
    } catch (error: any) {
      console.error("GitHub Export Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "GitHub export failed", 
        details: error.message || (error.response?.data?.message) 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Neurate AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
