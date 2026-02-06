
import { GoogleGenAI } from "@google/genai";
import { Message, Sender, AnalysisResult, AssessmentScores, CandidateProfile, BigFiveTraits } from "../types";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export const sendMessageToGemini = async (
  history: Message[],
  latestUserMessage: string,
  systemInstruction: string 
): Promise<{ text: string; analysis: AnalysisResult | null }> => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction, 
        temperature: 0.3,
      },
      history: history.slice(0, -1).map(msg => ({
        role: msg.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))
    });

    const result = await chat.sendMessage({
      message: latestUserMessage
    });

    const responseText = result.text;
    
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
        // UPDATED PROMPT: STRICT CORRELATION LOGIC + BEHAVIOR
        const prompt = `
        Role: Expert I/O Psychologist & Senior Recruiter at Mobeng.
        Task: CRITICALLY analyze candidate performance by correlating COGNITIVE ABILITY (Logic Test) with BEHAVIORAL COMPETENCE (Interview).
        
        Candidate: ${profile.name} (Position: ${role})
        
        DATA:
        1. Logic Test Score: ${logicScore.toFixed(1)}/10 (Cognitive Baseline)
        2. Behavioral SJT Scores: Sales(${simScores.sales}), Leadership(${simScores.leadership}), Ops(${simScores.operations}), CX(${simScores.cx})
        3. AI Interview Log: "${simFeedback}"
        
        **MANDATORY CORRELATION ANALYSIS (RULES):**
        - **If Logic < 5.0**: Check if their interview answers were unstructured, confusing, or lacked root-cause analysis. If yes, confirm "Low Cognitive Ability".
        - **If Logic > 8.0 BUT Interview Scores < 6**: Flag as "Smart but Lazy/Arrogant" or "Poor Communication". High logic should correlate with structured thinking.
        - **If Logic > 7.0 AND Interview > 8**: Validate as "High Potential / Star Performer".
        - **If Logic < 5.0 BUT Interview > 8**: Check if they are just "Sweet Talkers" (Good words, low logic). Be skeptical of this pattern.

        **EVALUATION CRITERIA (MOBENG STANDARD):**
        1. **Substance over Style**: Did they give specific steps or just "sweet talk"?
        2. **Action Oriented**: Did they take ownership or blame others?
        
        OUTPUT REQUIREMENT (JSON):
        
        1. **Culture Fit Score** (1-100):
           - < 60: Too theoretical, robotic, lacks integrity, or LOW LOGIC (<4).
           - 60-80: Standard answers, safe player.
           - > 85: Exceptional detail, high logic correlation, concrete steps.
           
        2. **Psychometrics (Big Five)**:
           - Derive OCEAN traits from their behavioral choices.
           
        3. **Executive Summary Text (Bahasa Indonesia)**:
           Must follow this EXACT format inside the string (Markdown):
           
           "**Profil Psikometrik:**
           [Jelaskan 2 kalimat tentang karakter asli dan stabilitas emosi.]
           
           **Analisa Kognitif & Logika:**
           - [WAJIB bahas Skor Logika (${logicScore.toFixed(1)}). Contoh: 'Skor Logika rendah (4.0) tercermin dari jawaban yang tidak terstruktur', atau 'Kecerdasan logika tinggi (9.0) terlihat dari kemampuan analisa masalah yang tajam', atau 'Anomali: Skor logika tinggi namun jawaban interview tidak mencerminkan kemampuan tersebut'.]

           **Analisa Kritis (Red Flags):**
           - [List kelemahan fatal. Contoh: 'Jawaban terlalu normatif', 'Cenderung menghindari konflik', 'Kurang detail teknis'.]
           
           **Prediksi Performa:**
           [Kategorikan: 'NATO (No Action Talk Only)', 'EXECUTOR' (Pekerja Keras), atau 'STRATEGIST'. Jelaskan alasannya.]
           
           **Rekomendasi Akhir:**
           [Pilih satu: 'PRIORITAS UTAMA', 'DIPERTIMBANGKAN', atau 'TIDAK DISARANKAN']"
           
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
                responseMimeType: "application/json"
            }
        });

        const json = JSON.parse(response.text);
        
        return {
            summary: json.summary,
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
