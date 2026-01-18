import { GoogleGenAI } from "@google/genai";
import { FileContext, Message } from "../types";

// Initialize client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCodeAnalysis = async (
  currentMessage: string,
  history: Message[],
  activeFiles: FileContext[],
  githubLink: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Error: API Key is missing. Please check your environment variables.";
  }

  try {
    // Construct the prompt context from active files
    let fileContextPrompt = "";
    const parts: any[] = [];

    // 1. Add System/Contextual Preamble regarding the Workspace
    let systemPreamble = `You are CodeCleanse AI, an expert Senior Software Engineer and Code Auditor. 
Your specific goals are:
1. Analyze code for bugs and logic errors.
2. AGGRESSIVELY identify "dead code", unused functions, redundant files, or deprecations.
3. Provide insights on how to refactor for maintainability.
4. When a repository is attached, understand its architecture using the provided REPOSITORY_MAP.md and the source files.

Current Workspace Context:
`;

    if (githubLink) {
      systemPreamble += `\nThe user is working with the following GitHub Repository: ${githubLink}. \nUse this link to infer project structure/architecture if possible, or guide the user based on conventions of that repo's tech stack.\n`;
    }

    if (activeFiles.length > 0) {
      systemPreamble += `\nThe user has attached ${activeFiles.length} file(s) for deep analysis:\n`;
      
      const hasStructureMap = activeFiles.some(f => f.name === 'REPOSITORY_MAP.md');
      if (hasStructureMap) {
         systemPreamble += `\n[CRITICAL]: 'REPOSITORY_MAP.md' is attached. It contains the FULL file list of the repository. Use it to understand the directory structure, locate files, and infer architecture, even if the file's content is not loaded in this session.\n`;
      }

      // Process files
      for (const file of activeFiles) {
        if (file.category === 'code' || file.category === 'other') {
          // Add text files directly to the prompt context clearly delimited
          systemPreamble += `\n--- START FILE: ${file.name} ---\n${file.content}\n--- END FILE: ${file.name} ---\n`;
        } else if (file.category === 'image') {
          // Add images as inline data parts
          parts.push({
            inlineData: {
              mimeType: file.type,
              data: file.content // Assuming content is base64 string without prefix for API, handled in component
            }
          });
        }
      }
    } else {
      systemPreamble += "\nNo specific files attached currently. Answer general coding questions.\n";
    }

    // Add the computed context as the first part (text)
    // We combine the history + current message strategy
    // Since generateContent is stateless, we reconstruct the conversation flow briefly
    // Note: For large file sets, we might hit token limits. Gemini 1.5/Pro has massive context, so this is usually fine.
    
    // Convert previous chat history to a format Gemini understands (conceptually)
    // or just append it to the prompt if we aren't using the chat session API.
    // For this specific "audit" use case, a single-turn rich context often works best, 
    // but let's try to keep some conversational history.
    
    let fullPrompt = systemPreamble + "\n\nChat History:\n";
    history.slice(-10).forEach(msg => {
      fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
    });

    fullPrompt += `\nUser's Current Query: ${currentMessage}`;

    // Push the text prompt
    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: "You are an expert code auditor. Output markdown. Use code blocks. Be concise.",
        thinkingConfig: { thinkingBudget: 1024 } // Allow some thinking for code analysis
      }
    });

    return response.text || "No response generated.";

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Error generating response: ${error.message || "Unknown error"}`;
  }
};