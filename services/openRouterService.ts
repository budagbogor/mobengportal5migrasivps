
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";
import { supabase } from "./supabaseClient";

// Cache
let cachedApiKey: string | null = null;

const getOpenRouterKey = async () => {
    if (cachedApiKey) return cachedApiKey;

    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'openrouter_api_key')
            .single();

        if (data && data.value) cachedApiKey = data.value;
    } catch (err) {
        console.warn("Failed to fetch OpenRouter key", err);
    }

    return cachedApiKey || (import.meta.env && import.meta.env.VITE_OPENROUTER_API_KEY) || '';
};

export const sendMessageToOpenRouter = async (
    history: Message[],
    latestUserMessage: string,
    systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) throw new Error("OpenRouter API Key missing");

    const messages = [
        { role: "system", content: systemInstruction },
        ...history.map(msg => ({
            role: msg.sender === Sender.USER ? "user" : "assistant",
            content: msg.text
        })),
        { role: "user", content: latestUserMessage }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://mobeng-portal.com", // Placeholder
            "X-Title": "Mobeng Recruitment Portal"
        },
        body: JSON.stringify({
            model: "meta-llama/llama-3.1-70b-instruct:free",
            messages: messages,
            temperature: 0.3
        })
    });

    if (!response.ok) throw new Error(`OpenRouter Error: ${response.statusText}`);

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";

    // Analysis parsing logic (same as Gemini)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
        try {
            analysis = JSON.parse(jsonMatch[1]);
            cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        } catch (e) {
            console.error("Failed to parse analysis JSON (OpenRouter)", e);
        }
    }

    return { text: cleanText, analysis };
};

export const generateSummaryWithOpenRouter = async (
    prompt: string
): Promise<any> => {
    const apiKey = await getOpenRouterKey();
    if (!apiKey) throw new Error("OpenRouter API Key missing");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "meta-llama/llama-3.1-70b-instruct:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3
        })
    });

    if (!response.ok) throw new Error(`OpenRouter Summary Error: ${response.statusText}`);

    const data = await response.json();
    const jsonText = data.choices?.[0]?.message?.content || "{}";

    // Clean potential key markdown
    const cleanJsonText = jsonText.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleanJsonText);
};
