
import { GoogleGenAI } from "@google/genai";
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";
import { supabase } from "./supabaseClient";
import { sendMessageToNvidia, generateSummaryWithNvidia } from "./nvidiaService";


// Cache the key in memory
let cachedApiKey: string | null = null;

const getGenAI = async () => {
  if (cachedApiKey) return new GoogleGenAI({ apiKey: cachedApiKey });

  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'gemini_api_key').single();
    if (data?.value) cachedApiKey = data.value;
  } catch (err) {
    console.warn("Failed to fetch Gemini API key", err);
  }

  const finalKey = cachedApiKey || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
  if (!finalKey) return null; // Return null instead of empty string to trigger fallback

  return new GoogleGenAI({ apiKey: finalKey });
};

// --- ORCHESTRATOR: Send Message ---
export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  let errors: string[] = [];

  // 1. Try NVIDIA (via Proxy) - PRIMARY
  try {
    console.log("Using NVIDIA (via Proxy) as Primary...");
    return await sendMessageToNvidia(history, latestUserMessage, systemInstruction);
  } catch (e: any) {
    console.error("NVIDIA Error:", e);
    errors.push(`NVIDIA: ${e.message}`);
  }

  // 2. Gemini (Disabled/Fallback)
  /*
  try {
    const ai = await getGenAI();
    if (ai) {
      const chat = ai.chats.create({
        model: "gemini-2.0-flash",
        config: { systemInstruction, temperature: 0.3 },
        history: history.slice(0, -1).map(msg => ({
          role: msg.sender === Sender.USER ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }))
      });
      const result = await chat.sendMessage({ message: latestUserMessage });
      const responseText = result.text || '';
      return parseResponse(responseText);
    } else {
      errors.push("Gemini Key Missing");
    }
  } catch (e: any) {
    console.error("Gemini Error:", e);
    errors.push(`Gemini: ${e.message}`);
  }
  */



  // 4. Final Fallback (Static/Error)
  return {
    text: "Maaf, sistem AI sedang offline (Semua koneksi gagal). Silakan hubungi Admin atau coba lagi nanti.",
    analysis: null
  };
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
      console.error("Failed to parse analysis JSON", e);
    }
  }
  return { text: cleanText, analysis };
};


// --- ORCHESTRATOR: Generate Summary ---

interface FinalAnalysisReport {
  summary: string;
  psychometrics: BigFiveTraits;
  cultureFitScore: number;
  starMethodScore: number;
}

// 4. Rule-Based Fallback System
const calculateFallbackScores = (
  role: string,
  simScores: AssessmentScores,
  logicScore: number
): FinalAnalysisReport => {
  console.warn("Using Rule-Based Fallback Scores");

  // Base Traits (All mid-range enabled)
  let traits: BigFiveTraits = {
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    neuroticism: 50
  };

  // Logic & Cognitive Influence
  if (logicScore >= 8) {
    traits.openness += 15; // Smart people usually open to new ideas
    traits.conscientiousness += 10;
  } else if (logicScore <= 4) {
    traits.conscientiousness -= 10;
  }

  // Role Influence
  const cleanRole = role.toLowerCase();

  if (cleanRole.includes('sales')) {
    traits.extraversion += 20; // Sales need to be chatty
    traits.agreeableness += 10;
    traits.conscientiousness += 5;
  } else if (cleanRole.includes('mechanic') || cleanRole.includes('mekanik')) {
    traits.extraversion -= 10;
    traits.conscientiousness += 20; // Mechanics must be precise
    traits.neuroticism += 10;
    traits.openness -= 5; // Stick to SOP
  } else if (cleanRole.includes('leader') || cleanRole.includes('kepala')) {
    traits.conscientiousness += 15;
    traits.extraversion += 10;
    traits.neuroticism += 15; // Leaders need to be calm
  }

  // Normalize (0-100)
  Object.keys(traits).forEach(k => {
    const key = k as keyof BigFiveTraits;
    traits[key] = Math.max(10, Math.min(95, traits[key]));
  });

  // Culture Fit: Based on SJT Scores (Ops & Leadership)
  let cultureScore = ((simScores.operations + simScores.leadership) / 2) * 10;
  // Boost if Logic is high (Smart ppl fit better usually)
  cultureScore += (logicScore * 2);
  cultureScore = Math.min(98, Math.max(40, cultureScore));

  // Star Method: Direct mapping from SJT Sales/Problem Solving
  // simScores are 0-10 based on usage
  let starScore = (simScores.sales + simScores.cx) / 2;
  starScore = Math.min(10, Math.max(1, starScore));

  const summaryText = `**Executive Summary (Generated via Logic Fallback System):**
  
  Candidate Profile generated based on Logic Test Score (${logicScore.toFixed(1)}/10) and Role Application (${role}).
  
  **1. Cognitive & Capabilities:**
  - Logic Score indicates ${logicScore > 7 ? "strong analytical skills" : logicScore < 4 ? "potential need for training" : "average problem-solving ability"}.
  
  **2. Role Fit (${role}):**
  - Psychometric projections suggest ${traits.conscientiousness > 70 ? "high reliability and attention to detail" : "moderate fit for current role requirements"}.
  
  **3. Potential Areas:**
  - Observe ${traits.extraversion < 40 ? "communication confidence" : "focus on SOP adherence"} during probation.
  
  **(Note: AI Services Unavailable due to connection issues - This is a statistical estimation)**`;

  return {
    summary: summaryText,
    psychometrics: traits,
    cultureFitScore: Math.round(cultureScore),
    starMethodScore: Math.round(starScore)
  };
};

export const generateFinalSummary = async (
  profile: CandidateProfile,
  role: string,
  simScores: AssessmentScores,
  simFeedback: string,
  logicScore: number
): Promise<FinalAnalysisReport> => {

  const prompt = `
        Role: Senior I/O Psychologist & Elite Recruiter (Google Standard).
        Task: Conduct a high-level candidate assessment using the "Google Hiring Attributes" framework.
        
        Candidate: ${profile.name} (Position: ${role})
        
        DATA POINTS:
        1. **General Cognitive Ability (GCA) Baseline**: ${logicScore.toFixed(1)}/10 (Logic Test Score)
        2. **Behavioral Competencies (SJT)**: Sales(${simScores.sales}), Leadership(${simScores.leadership}), Ops(${simScores.operations}), CX(${simScores.cx})
        3. **Interview Transcript Analysis**: "${simFeedback}"
        
        ### ANALYSIS FRAMEWORK (MANDATORY):
        
        **1. General Cognitive Ability (GCA) in Automotive Context**
        - Can they explain complex technical issues (cars/engines) in simple terms?
        - High Logic + Structured Answer = **Strong GCA (Good for Service Advisor/Leader)**.
        - High Logic + Unstructured = **Potential Lazy/Arrogant**.
        - Low Logic + Structured = **Hard Worker (Good for Mechanic/Admin)**.

        **2. Role-Related Knowledge (RRK) - Workshop & Retail**
        - **Technical Awareness**: Did they show understanding of bengkel operations (SPK, Spareparts, Service Flow)?
        - **Sales & Service**: Did they show ability to upsell (e.g., oil, tires) HONESTLY?
        - **Trust Factor**: Automotive industry relies on TRUST. Did they sound honest or manipulative?

        **3. Leadership & "Mobeng Way"**
        - **Operational Discipline**: Workshops require strict SOP adherence. Did they respect rules?
        - **Emergent Leadership**: Taking ownership when the workshop is busy/chaos.

        **4. Googleyness (Culture Fit)**
        - **Customer Obsession**: Willing to go extra mile for customer safety?
        - **Integrity**: ZERO TOLERANCE for cheating/lying (Crucial in auto service).

        ---

        ### OUTPUT REQUIREMENT (JSON):
        
        1. **Culture Fit Score** (1-100):
           - Based on Integrity & Service Orientation.
           - < 60: Toxic, Dishonest, or "Sok Tahu".
           - > 85: High Integrity, Customer First, Hardworking.
           
        2. **Psychometrics (Big Five)**:
           - Derive OCEAN traits strictly from behavioral evidence.
           
        3. **Executive Summary Text (Bahasa Indonesia)**:
           Must follow this EXACT Markdown format:
           
           "**Executive Summary (Automotive Industry Standard):**
           [2 sentences summarizing the candidate's profile for a Workshop/Retail environment.]

           **1. Cognitive & Problem Solving (GCA):**
           - [Analysis of logic vs communication clarity. Mention the Logic Score ${logicScore.toFixed(1)} explicitly.]
           
           **2. Automotive Retail & Technical Fit (RRK):**
           - [Analysis of sales capability, technical understanding, and operational awareness.]

           **3. Leadership, Integrity & 'The Mobeng Way':**
           - [Analysis of ownership, honesty (crucial), and discipline.]
           
           **4. Psychometric Insights (OCEAN):**
           - [Highlight dominant traits (e.g., 'High Conscientiousness important for SOP adherence', 'High Agreeableness good for CS').]

           **5. Red Flags / Areas for Improvement:**
           - [Critical weaknesses if any.]

           **6. Saran Pengembangan & Training (Development Plan):**
           - [Concrete steps to improve. Examples: 'Perlu training product knowledge lebih dalam', 'Rotasi ke bagian Front Office untuk melatih komunikasi', 'Mentoring langsung dengan Kepala Bengkel'.]
           
           **Final Verdict:**
           [One of: 'HIRE (Strong)', 'HIRE (Standard)', 'NO HIRE']"
           
        JSON STRUCTURE:
        {
            "summary": "The formatted text string above...",
            "psychometrics": {
                "openness": number,
                "conscientiousness": number,
                "extraversion": number,
                "agreeableness": number,
                "emotionalStability": number
            },
            "cultureFitScore": number,
            "starMethodScore": number
        }
        `;

  // 1. NVIDIA (via Proxy) - PRIMARY
  try {
    console.log("Generating Summary with NVIDIA (via Proxy)...");
    const json = await generateSummaryWithNvidia(prompt);
    return {
      summary: json.summary + "\n\n(Source: NVIDIA Llama 3.1 70B)",
      psychometrics: json.psychometrics,
      cultureFitScore: json.cultureFitScore,
      starMethodScore: json.starMethodScore
    };
  } catch (e) {
    console.error("NVIDIA Summary Failed", e);
  }

  // 2. Gemini (Disabled)
  /*
  try {
    const ai = await getGenAI();
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.3 }
      });
      const json = JSON.parse(response.text || '{}');
      return {
        summary: json.summary + "\n\n(Source: Gemini 2.0 Flash)",
        psychometrics: json.psychometrics,
        cultureFitScore: json.cultureFitScore,
        starMethodScore: json.starMethodScore
      };
    }
  } catch (e) {
    console.error("Gemini Summary Failed", e);
  }
  */



  // 4. Rule-Based Fallback
  return calculateFallbackScores(role, simScores, logicScore);
}
