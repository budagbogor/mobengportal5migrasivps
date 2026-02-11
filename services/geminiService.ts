
import { GoogleGenAI } from "@google/genai";
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";

// Helper to get the AI instance dynamically
// Priorities: 1. LocalStorage (Admin Setting), 2. Environment Variable
const getGenAI = () => {
  const localKey = localStorage.getItem('gemini_api_key');
  // VITE CHANGE: Use import.meta.env instead of process.env, with safety check
  const finalKey = localKey || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

  if (!finalKey) {
    console.warn("API Key is missing. Please configure it in settings or VITE_GEMINI_API_KEY env var.");
  }

  return new GoogleGenAI({ apiKey: finalKey });
};

export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  try {
    // Create instance dynamically to pick up new keys immediately
    const ai = getGenAI();

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, // Low temperature to reduce hallucinations
      },
      history: history.slice(0, -1).map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    });

    const result = await chat.sendMessage({
      message: latestUserMessage
    });

    const responseText = result.text || ''; // Handle undefined

    // Updated Regex: More robust, allows spaces instead of strict newlines
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let analysis: AnalysisResult | null = null;
    let cleanText = responseText;

    if (jsonMatch && jsonMatch[1]) {
      try {
        analysis = JSON.parse(jsonMatch[1]);
        // Remove the JSON block from the text shown to user
        cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      } catch (e) {
        console.error("Failed to parse analysis JSON", e);
      }
    }

    return {
      text: cleanText,
      analysis: analysis
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

interface FinalAnalysisReport {
  summary: string;
  psychometrics: BigFiveTraits;
  cultureFitScore: number;
  starMethodScore: number;
}

export const generateFinalSummary = async (
  profile: CandidateProfile,
  role: string,
  simScores: AssessmentScores,
  simFeedback: string,
  logicScore: number
): Promise<FinalAnalysisReport> => {
  try {
    // Create instance dynamically
    const ai = getGenAI();

    // UPDATED PROMPT: GOOGLE RECRUITMENT STANDARD (GCA, RRK, Leadership, Googleyness)
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3, // Explicitly set low temperature to prevent hallucinations
      }
    });

    const jsonText = response.text || '{}'; // Handle undefined
    let json;
    try {
      json = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse final summary JSON", e);
      throw e; // Trigger catch block below
    }

    return {
      summary: json.summary || "Analisa tidak tersedia.",
      psychometrics: {
        openness: json.psychometrics.openness,
        conscientiousness: json.psychometrics.conscientiousness,
        extraversion: json.psychometrics.extraversion,
        agreeableness: json.psychometrics.agreeableness,
        neuroticism: json.psychometrics.emotionalStability
      },
      cultureFitScore: json.cultureFitScore,
      starMethodScore: json.starMethodScore
    };

  } catch (error) {
    console.error("Error generating final summary:", error);
    return {
      summary: "Gagal membuat analisa. Data tidak cukup.",
      psychometrics: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
      cultureFitScore: 50,
      starMethodScore: 5
    };
  }
}
