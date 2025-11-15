import { GoogleGenAI, Type } from "@google/genai";
import type { AIRecommendations } from '../types';

export const generateAIRecommendationsService = async (location: string, disasters: string[], readinessScore: number): Promise<AIRecommendations> => {
  // Assume process.env.API_KEY is available in the environment
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    throw new Error("API_KEY not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a disaster preparedness expert. Generate a personalized emergency plan for:
Location: ${location || 'Miami Gardens, Florida'}
Disasters: ${disasters.join(', ') || 'Hurricane'}
Current readiness: ${readinessScore}%

Provide a JSON response with the exact structure defined in the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgentActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 3-5 immediate, high-priority actions the user should take based on their location and potential disasters."
            },
            weeklyTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 2-3 actionable tips the user can do weekly to improve their preparedness over time."
            },
            locationSpecific: {
              type: Type.STRING,
              description: "A concise paragraph of advice tailored specifically to the user's geographical location and the selected disaster types."
            },
          },
          required: ["urgentActions", "weeklyTips", "locationSpecific"],
        },
      },
    });

    const jsonText = response.text.trim();
    const recommendations = JSON.parse(jsonText) as AIRecommendations;
    return recommendations;
  } catch (error) {
    console.error("Error generating AI recommendations with Gemini:", error);
    // Return a fallback object on error
    return {
      urgentActions: [
        "Stock at least 3 gallons of water per person for 3 days.",
        "Prepare a first-aid kit with essential supplies.",
        "Have a battery-powered or hand-crank radio for alerts.",
        "Charge all electronic devices and power banks."
      ],
      weeklyTips: [
        "Review your family's emergency communication plan.",
        "Check expiration dates on food and water in your kit.",
      ],
      locationSpecific: `For your location (${location || 'your area'}), it's crucial to have a plan for ${disasters.join(', ') || 'potential disasters'}. Familiarize yourself with local evacuation routes and shelters.`,
    };
  }
};

export const getLocationNameFromCoords = async (latitude: number, longitude: number): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    throw new Error("API_KEY not found");
  }
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Provide the location in "City, State" format for latitude: ${latitude} and longitude: ${longitude}. Respond with only the city and state name, for example: "Mountain View, California". Do not add any other text, explanation, or markdown formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error getting location name from coordinates:", error);
    return "Could not determine location";
  }
};