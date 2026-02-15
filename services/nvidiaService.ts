import { Message, Sender, AnalysisResult } from "../types";

// Base URL points to our local proxy (dev or prod)
// In Dev: Vite resolves /api/nvidia -> https://integrate.api.nvidia.com
// In Prod: Express resolves /api/nvidia -> https://integrate.api.nvidia.com
const API_BASE_URL = '/api/nvidia/v1/chat/completions';

export const sendMessageToNvidia = async (
    history: Message[],
    latestUserMessage: string,
    systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {

    // Construct messages array
    const messages = [
        { role: "system", content: systemInstruction },
        ...history.map(msg => ({
            role: msg.sender === Sender.USER ? "user" : "assistant",
            content: msg.text
        })),
        { role: "user", content: latestUserMessage }
    ];

    try {
        const response = await fetch(API_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
                // No Authorization header here - it's handled by the proxy!
            },
            body: JSON.stringify({
                model: "meta/llama-3.1-70b-instruct",
                messages: messages,
                temperature: 0.5,
                top_p: 1,
                max_tokens: 1024,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NVIDIA API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || "";

        return parseResponse(responseText);

    } catch (error) {
        console.error("NVIDIA Service Error:", error);
        throw error;
    }
};

export const generateSummaryWithNvidia = async (
    prompt: string
): Promise<any> => {
    try {
        const response = await fetch(API_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta/llama-3.1-70b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5,
                top_p: 1,
                max_tokens: 1024,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NVIDIA Summary Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const jsonText = data.choices?.[0]?.message?.content || "{}";

        // Clean markdown if present
        const cleanJsonText = jsonText.replace(/```json\s*|\s*```/g, "").trim();
        return JSON.parse(cleanJsonText);

    } catch (error) {
        console.error("NVIDIA Summary Error:", error);
        throw error;
    }
};

const parseResponse = (responseText: string) => {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
        try {
            analysis = JSON.parse(jsonMatch[1]);
            cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        } catch (e) {
            console.error("Failed to parse analysis JSON (NVIDIA)", e);
        }
    }
    return { text: cleanText, analysis };
};
