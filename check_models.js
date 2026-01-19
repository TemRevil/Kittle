import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function list() {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
        console.log("No API Key found");
        return;
    }
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    try {
        const models = await ai.models.list();
        console.log("Available models (v1beta):");
        models.forEach(m => console.log(`- ${m.name}`));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}
list();
