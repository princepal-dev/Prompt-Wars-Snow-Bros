
import { GoogleGenAI, Type } from "@google/genai";
import { WaveConfig } from "../types";

// Fallback waves if AI fails or key is missing
const FALLBACK_WAVES: WaveConfig[] = [
  { 
    enemyCount: 3, 
    spawnInterval: 120, 
    enemySpeed: 0.5, 
    aggressiveness: 0.1, 
    message: "System Boot... Initializing Protocol.",
    enemyTheme: { name: "Glitch Bugs", color: "#ef4444", description: "Basic system anomalies." },
    layout: [
      { x: 100, y: 400, w: 200, h: 20 }, { x: 500, y: 400, w: 200, h: 20 },
      { x: 300, y: 250, w: 200, h: 20 }
    ]
  },
  { 
    enemyCount: 5, 
    spawnInterval: 100, 
    enemySpeed: 0.7, 
    aggressiveness: 0.3, 
    message: "Threat Detected. Swarm incoming.",
    enemyTheme: { name: "Neon Wasps", color: "#eab308", description: "Fast moving stinging units." },
    layout: [
      { x: 50, y: 450, w: 150, h: 20 }, { x: 600, y: 450, w: 150, h: 20 },
      { x: 200, y: 300, w: 400, h: 20 },
      { x: 350, y: 150, w: 100, h: 20 }
    ]
  },
  { 
    enemyCount: 8, 
    spawnInterval: 80, 
    enemySpeed: 1.0, 
    aggressiveness: 0.6, 
    specialEvent: 'BLIZZARD', 
    message: "BLIZZARD PROTOCOL ACTIVE",
    enemyTheme: { name: "Frost Golems", color: "#3b82f6", description: "Heavily armored ice constructs." },
    layout: [
      { x: 100, y: 500, w: 100, h: 20 }, { x: 600, y: 500, w: 100, h: 20 },
      { x: 100, y: 350, w: 100, h: 20 }, { x: 600, y: 350, w: 100, h: 20 },
      { x: 100, y: 200, w: 100, h: 20 }, { x: 600, y: 200, w: 100, h: 20 },
      { x: 350, y: 350, w: 100, h: 20 }
    ]
  },
  { 
    enemyCount: 12, 
    spawnInterval: 60, 
    enemySpeed: 1.2, 
    aggressiveness: 0.8, 
    message: "CRITICAL ALERT: OVERRUN",
    enemyTheme: { name: "Void Stalkers", color: "#a855f7", description: "Entities from the null sector." },
    layout: [
       { x: 100, y: 450, w: 600, h: 20 },
       { x: 200, y: 300, w: 400, h: 20 },
       { x: 300, y: 150, w: 200, h: 20 }
    ]
  },
];

export class GeminiDirector {
  private ai: GoogleGenAI | null = null;
  private isOfflineMode: boolean = false;

  constructor() {
    if (process.env.API_KEY && process.env.API_KEY !== "runtime_api_key_placeholder") {
      try {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      } catch (e) {
        console.error("Gemini Init Failed", e);
        this.isOfflineMode = true;
      }
    } else {
      this.isOfflineMode = true;
    }
  }

  async generateWave(waveNumber: number, playerPerformance: { score: number, timeTaken: number }): Promise<WaveConfig> {
    // Return fallback immediately if no AI or offline
    if (!this.ai || this.isOfflineMode) {
      return this.getFallbackWave(waveNumber);
    }

    const aiCall = this.callGemini(waveNumber, playerPerformance);
    
    // Timeout Promise (Reduced to 800ms to ensure responsiveness)
    const timeout = new Promise<WaveConfig>((resolve) => {
        setTimeout(() => resolve(this.getFallbackWave(waveNumber)), 800);
    });

    try {
        return await Promise.race([aiCall, timeout]);
    } catch (e) {
        return this.getFallbackWave(waveNumber);
    }
  }

  private async callGemini(waveNumber: number, playerPerformance: { score: number, timeTaken: number }): Promise<WaveConfig> {
    const prompt = `
      Current Level: ${waveNumber}.
      Player Score: ${playerPerformance.score}.
      Time Last Level: ${playerPerformance.timeTaken}s.
      
      Design the next level configuration.
      1. Difficulty: If player is fast (<30s), increase enemySpeed and aggressiveness.
      2. Event: If levelNumber % 3 == 0, trigger BLIZZARD event.
      3. Enemy Design: Invent a new retro-sci-fi enemy type for this level. Give it a cool name, a bright HEX color, and a 1-sentence lore description.
      4. Level Layout: Design 3 to 6 platforms for this level. 
         World size is 800x600. Floor is at y=560. 
         Platforms should be between x=[50, 750] and y=[150, 500].
         Ensure they are jumpable (max jump height ~150px).
    `;

    try {
      const response = await this.ai!.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "You are the AI Director of a retro arcade game 'Snow Bros 2026'. Generate balanced but challenging wave configurations based on player performance. Return only valid JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              enemyCount: { type: Type.INTEGER },
              spawnInterval: { type: Type.INTEGER, description: "Frames between spawns (60 = 1s)" },
              enemySpeed: { type: Type.NUMBER },
              aggressiveness: { type: Type.NUMBER },
              specialEvent: { type: Type.STRING, enum: ["NONE", "BLIZZARD"] },
              message: { type: Type.STRING, description: "Short retro arcade taunt" },
              enemyTheme: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  color: { type: Type.STRING, description: "Hex color code" },
                  description: { type: Type.STRING }
                }
              },
              layout: {
                type: Type.ARRAY,
                description: "List of platform rectangles",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.INTEGER },
                    y: { type: Type.INTEGER },
                    w: { type: Type.INTEGER },
                    h: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        }
      });

      if (response.text) {
        let cleanText = response.text.trim();
        // Remove markdown code blocks if present
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
        }
        return JSON.parse(cleanText) as WaveConfig;
      }
    } catch (e: any) {
      // Handle quota or other API errors gracefully
      if (e.status === 429 || (e.message && e.message.includes('429')) || (e.message && e.message.includes('quota'))) {
         console.warn("Gemini Quota Exceeded. Switching to Offline Director Mode.");
         this.isOfflineMode = true;
      }
    }
    return this.getFallbackWave(waveNumber);
  }

  private getFallbackWave(waveNumber: number): WaveConfig {
    return FALLBACK_WAVES[Math.min(waveNumber - 1, FALLBACK_WAVES.length - 1)] || FALLBACK_WAVES[FALLBACK_WAVES.length - 1];
  }
}
