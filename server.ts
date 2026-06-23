import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for AI Tutor
  app.post('/api/tutor', async (req, res) => {
    try {
      const { code, instructions, errorMsg } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are an expert coding tutor. Your goal is to guide the student without giving away the direct answer.
The student is trying to solve the following instructions:
"${instructions}"

The student's current code is:
\`\`\`
${code}
\`\`\`

The student received this validation feedback:
"${errorMsg}"

Provide a brief, encouraging hint to help the student figure out what's wrong and how to fix it. Do not just output the correct code. Explain conceptually. Keep the response under 4 sentences.
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ hint: response.text });
    } catch (error: any) {
      console.error('Tutor error:', error);
      res.status(500).json({ error: 'Failed to generate tutor hint.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
