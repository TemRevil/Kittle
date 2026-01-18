import { GoogleGenAI } from "@google/genai";
import { FileContext, Message, LLMConfig, ThinkingMode } from "../types";

export interface StreamUpdate {
  textDelta?: string;
  thinkingDelta?: string;
  done?: boolean;
}

export async function* streamLLMResponse(
  config: LLMConfig,
  currentMessage: string,
  history: Message[],
  activeFiles: FileContext[],
  githubLink: string,
  thinkingMode: ThinkingMode,
  isSearchEnabled: boolean
): AsyncGenerator<StreamUpdate, void, unknown> {
  const { provider, model, apiKeys } = config;
  const apiKey = apiKeys[provider];

  if (!apiKey) {
    yield { textDelta: `Error: API Key for ${provider} is missing. Please add it in the model selector.` };
    return;
  }

  // --- CONTEXT CONSTRUCTION ---
  const systemLines = [
    "You are CodeCleanse AI, an intelligent and helpful AI assistant.",
    "",
    "CORE BEHAVIOR:",
    "1. If files or code are provided, act as an Expert Senior Software Engineer (Auditor). Look for bugs, dead code, and refactoring opportunities.",
    "2. If NO files/code are provided, act as a witty, knowledgeable, and general-purpose assistant.",
    "",
    "Thinking Process:",
    "- If the model supports thinking (reasoning), use it for complex tasks.",
    "- If using a model without native thinking, simply answer directly.",
    "- When explaining code, be concise but thorough.",
  ];

  if (thinkingMode === 'concise') {
    systemLines.push("MODE: CONCISE. Be direct. Use code blocks immediately.");
  } else {
    systemLines.push("MODE: DEEP DIVE. Be thorough. Explain \"Why\".");
  }

  if (isSearchEnabled) {
    systemLines.push("SEARCH: You have access to Google Search. Use it for current events/docs.");
  }

  if (githubLink) systemLines.push(`Context Repo: ${githubLink}`);
  
  const systemInstructionText = systemLines.join("\n");

  // Build the user context string (files + query)
  let userContext = "";
  if (activeFiles.length > 0) {
    userContext += `\nAttached Files (${activeFiles.length}):\n`;
    activeFiles.forEach(f => {
      // Only append text/code files here. Images are added as inlineData.
      if (f.category === 'code' || f.category === 'other') {
        userContext += `\n--- START FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`;
      }
    });
  }
  userContext += `\nQuery: ${currentMessage}`;

  try {
    // --- GOOGLE GEMINI STREAMING ---
    if (provider === 'google') {
      const ai = new GoogleGenAI({ apiKey });
      
      // Construct conversation history using strict Content format
      // Note: Google GenAI expects roles to be 'user' or 'model'
      const contents: any[] = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      // Create the current user message parts
      const currentParts: any[] = [{ text: userContext }];
      
      // Add images to the current message if any
      activeFiles.filter(f => f.category === 'image').forEach(f => {
        currentParts.push({ inlineData: { mimeType: f.type, data: f.content } });
      });

      contents.push({ role: 'user', parts: currentParts });

      // Configure Request
      const requestConfig: any = {
        systemInstruction: { parts: [{ text: systemInstructionText }] },
      };

      // Handle Tools (Search)
      // Note: Thinking models often don't support tools in preview, so we disable search if thinking is implied
      // to prevent 400 Bad Request (which shows as Failed to Fetch in CORS mode).
      const isThinkingModel = model.includes('thinking') || model.includes('reasoner');
      if (isSearchEnabled && !isThinkingModel) {
        requestConfig.tools = [{ googleSearch: {} }];
      }

      // Handle Thinking Config
      // Gemini 2.0 Flash Thinking works automatically. 
      // Gemini 3.0 might need explicit budget if we want to force it, but defaults are usually safer.
      if (model.includes('gemini-3')) {
         // Only set budget for Gemini 3 if we want to override default behavior
         requestConfig.thinkingConfig = { thinkingBudget: 1024 }; 
      }

      const result = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: requestConfig
      });

      let buffer = "";
      let inThinkingBlock = false;

      for await (const chunk of result) {
        const chunkText = chunk.text || "";
        
        // Gemini parsing logic
        for (let i = 0; i < chunkText.length; i++) {
          const char = chunkText[i];
          buffer += char;

          if (inThinkingBlock) {
             if (buffer.endsWith("</thinking>")) {
               inThinkingBlock = false;
               const content = buffer.slice(0, -11); 
               if (content) yield { thinkingDelta: content };
               buffer = "";
             } else if (buffer.length > 50) {
               const safePart = buffer.slice(0, -15);
               if (safePart) {
                 yield { thinkingDelta: safePart };
                 buffer = buffer.slice(-15);
               }
             }
          } else {
             if (buffer.endsWith("<thinking>")) {
               inThinkingBlock = true;
               const content = buffer.slice(0, -10);
               if (content) yield { textDelta: content };
               buffer = "";
             } else if (!buffer.includes("<") || buffer.length > 20) {
               if (buffer.includes("<") && !buffer.includes("<thinking") && buffer.length > 15) {
                  yield { textDelta: buffer };
                  buffer = "";
               } else if (!buffer.includes("<")) {
                  yield { textDelta: buffer };
                  buffer = "";
               }
             }
          }
        }
      }
      
      if (buffer) {
         if (inThinkingBlock) yield { thinkingDelta: buffer.replace("</thinking>", "") };
         else yield { textDelta: buffer };
      }
    }

    // --- DEEPSEEK STREAMING ---
    // Note: DeepSeek API does not support Browser CORS. This usually fails without a proxy.
    else if (provider === 'deepseek') {
       yield { textDelta: "Error: DeepSeek API does not support direct browser access (CORS). Please use a proxy or switch to Gemini." };
       return;
    }

    // --- OPENAI STREAMING ---
    else if (provider === 'openai') {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemInstructionText },
            ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
            { role: "user", content: userContext }
          ],
          stream: true
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenAI Error: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content;
              if (content) yield { textDelta: content };
            } catch (e) { }
          }
        }
      }
    }

    // --- ANTHROPIC STREAMING ---
    else if (provider === 'anthropic') {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [
            // Anthropic doesn't support system role in messages usually, use system param
            // But here we put everything in user message for simplicity or proper system param if supported
            { role: "user", content: systemInstructionText + "\n\n" + userContext }
          ],
          stream: true
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Anthropic Error: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const json = JSON.parse(data);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield { textDelta: json.delta.text };
              }
            } catch (e) { }
          }
        }
      }
    }

  } catch (error: any) {
    console.error("Stream Error:", error);
    let msg = error.message || "Failed to fetch response";
    if (msg.includes("Failed to fetch")) {
       msg += " (Network error or CORS block. Check API Key and Internet)";
    }
    yield { textDelta: `\n\n[Error: ${msg}]` };
  }
}
