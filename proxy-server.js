import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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'; // Fallback for demo

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy Endpoint for Chat Completions
app.post('/api/nvidia/v1/chat/completions', async (req, res) => {
    try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NVIDIA_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('NVIDIA API Error:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// All other requests serve index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`NVIDIA Proxy active at /api/nvidia/v1/chat/completions`);
});
