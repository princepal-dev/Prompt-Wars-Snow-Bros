import { GoogleGenAI, Type } from "@google/genai";
import { WaveConfig } from "../types";

// Fallback waves if AI fails or key is missing
const FALLBACK_WAVES: WaveConfig[] = [
  { enemyCount: 3, spawnInterval: 120, enemySpeed: 0.5, aggressiveness: 0.1, message: "System Boot... Initializing Protocol." },
  { enemyCount: 5, spawnInterval: 100, enemySpeed: 0.7, aggressiveness: 0.3, message: "Threat Detected. Swarm incoming." },
  { enemyCount: 8, spawnInterval: 80, enemySpeed: 1.0, aggressiveness: 0.6, specialEvent: 'BLIZZARD', message: "BLIZZARD PROTOCOL ACTIVE" },
  { enemyCount: 12, spawnInterval: 60, enemySpeed: 1.2, aggressiveness: 0.8, message: "CRITICAL ALERT: OVERRUN" },
];

export class GeminiDirector {
  private ai: GoogleGenAI | null = null;
  private isOfflineMode: boolean = false;

  constructor() {
    if (process.env.API_KEY) {
      try {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      } catch (e) {
        console.error("Gemini Init Failed", e);
      }
    }
  }

  async generateWave(waveNumber: number, playerPerformance: { score: number, timeTaken: number }): Promise<WaveConfig> {
    // Return fallback immediately if no AI or offline
    if (!this.ai || this.isOfflineMode) {
      return this.getFallbackWave(waveNumber);
    }

    const aiCall = this.callGemini(waveNumber, playerPerformance);
    
    // Timeout Promise (1.5s max wait for snappy gameplay)
    const timeout = new Promise<WaveConfig>((resolve) => {
        setTimeout(() => resolve(this.getFallbackWave(waveNumber)), 1500);
    });

    try {
        return await Promise.race([aiCall, timeout]);
    } catch (e) {
        return this.getFallbackWave(waveNumber);
    }
  }

  private async callGemini(waveNumber: number, playerPerformance: { score: number, timeTaken: number }): Promise<WaveConfig> {
    const prompt = `
      You are the AI Director of a retro arcade game 'Snow Bros 2026'.
      Current Wave: ${waveNumber}.
      Player Score: ${playerPerformance.score}.
      Time Last Wave: ${playerPerformance.timeTaken}s.
      
      Design the next wave.
      If player is fast (<30s), increase enemySpeed and aggressiveness.
      If waveNumber % 3 == 0, trigger BLIZZARD event.
      
      Return JSON only matching the schema.
    `;

    try {
      const response = await this.ai!.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              enemyCount: { type: Type.INTEGER },
              spawnInterval: { type: Type.INTEGER, description: "Frames between spawns (60 = 1s)" },
              enemySpeed: { type: Type.NUMBER },
              aggressiveness: { type: Type.NUMBER },
              specialEvent: { type: Type.STRING, enum: ["NONE", "BLIZZARD"] },
              message: { type: Type.STRING, description: "Short retro arcade taunt" }
            }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as WaveConfig;
      }
    } catch (e: any) {
      if (e.status === 429 || (e.message && e.message.includes('429')) || (e.message && e.message.includes('quota'))) {
         console.warn("Gemini Quota Exceeded. Switching to Offline Director Mode.");
         this.isOfflineMode = true;
      }
      throw e; // Let race catch it or return fallback
    }
    return this.getFallbackWave(waveNumber);
  }

  private getFallbackWave(waveNumber: number): WaveConfig {
    return FALLBACK_WAVES[Math.min(waveNumber - 1, FALLBACK_WAVES.length - 1)] || FALLBACK_WAVES[FALLBACK_WAVES.length - 1];
  }
}