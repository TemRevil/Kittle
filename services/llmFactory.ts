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
  isSearchEnabled: boolean,
  isDesignMode: boolean
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

  // Check if model supports complex visual reasoning
  const capableVisualModels = ['gemini', 'gpt-4', 'claude-3', 'sonnet', 'opus', 'o1', 'deepseek', 'f1'];
  const isVisualCapable = capableVisualModels.some(m => model.toLowerCase().includes(m));

  if (isDesignMode) {
    if (isVisualCapable) {
      systemLines.push("### VISUAL MODE ACTIVE ###");
      systemLines.push("CAPABILITIES UPDATE: You have been integrated with a Mermaid.js rendering engine.");
      systemLines.push("CRITICAL RULE: When asked for visuals/diagrams, you MUST output a markdown code block with language 'mermaid'.");
      systemLines.push("DO NOT say 'I cannot create images' or 'Imagine a tree'.");
      systemLines.push("PROHIBITED: Do not use ASCII art, text trees, `|--`, `+--`, or indented lists for structure.");
      systemLines.push("PROHIBITED: Do not use invalid graph directions like 'CR' or 'Center-Right'. Use ONLY: 'TD', 'LR', 'TB', 'RL'.");
      systemLines.push("REQUIRED: You must use ```mermaid code blocks.");
      systemLines.push("CRITICAL INSTRUCTION: You MUST STOP generating text immediately after the closing ``` of the diagram.");
      systemLines.push("DO NOT write any explanation, notes, or titles after the diagram. The user wants to see the diagram finish loading first.");
      systemLines.push("Example:\n```mermaid\ngraph TD\nA-->B\n```\n(STOP HERE)");
    } else {
      systemLines.push("### VISUAL MODE REQUESTED ###");
      systemLines.push("NOTE: The user has requested visual diagrams, but this model may be less optimized for generation.");
      systemLines.push("Try your best to use Mermaid.js (```mermaid) for structures, but prioritize correctness.");
    }
  } else {
    // Design Mode is OFF - prohibit diagrams
    systemLines.push("### VISUAL MODE DISABLED ###");
    systemLines.push("IMPORTANT: The user has NOT enabled Design Mode. You cannot create diagrams or visual outputs.");
    systemLines.push("If the user asks for a diagram, chart, or visual, politely inform them: 'To generate visual diagrams, please enable Design Mode (the Layers icon in the toolbar).'");
    systemLines.push("STRICT PROHIBITION: Do NOT output any ```mermaid``` code blocks. The system suppresses them if Design Mode is off, confusing the user.");
    systemLines.push("Respond with text explanations only.");
  }

  if (githubLink) systemLines.push(`Context Repo: ${githubLink}`);

  if (activeFiles.length > 0) {
    systemLines.push("CRITICAL CONTEXT: The user has attached specific files. You MUST read and analyze these files deeply.");
    systemLines.push("Refuse to hallucinate. If the answer is in the files, cite it. If not, say so.");
  }

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

  if (!isDesignMode) {
    userContext += `\n\n[SYSTEM INSTRUCTION]: Visual Design Mode is currently DISABLED. You are PROHIBITED from generating diagram code (like mermaid). If the user asked for a visual, you MUST refuse and use text/lists instead. DO NOT generate 'mermaid' code blocks.`;
  } else {
    // Explicitly confirm enablement to override any previous history restrictions
    userContext += `\n\n[SYSTEM INSTRUCTION]: Visual Design Mode is ENABLED. If relevant, you may generate mermaid diagrams using \`\`\`mermaid code blocks.`;
  }

  try {
    // --- GOOGLE GEMINI STREAMING ---
    if (provider === 'google') {
      const ai = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta'
      });

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
      const generationConfig: any = {};

      // Handle Tools (Search)
      // Note: Thinking models often don't support tools in preview
      const isThinkingModel = model.includes('thinking') || model.includes('reasoner') || model.includes('gemini-3');
      const tools = (isSearchEnabled && !isThinkingModel) ? [{ googleSearch: {} }] : undefined;

      // Handle Thinking Config
      const isReasoningModel =
        model.includes('thinking') ||
        model.includes('reasoner') ||
        model.includes('think') ||
        model.includes('deep') ||
        model.includes('gemini-2.5') ||
        model.includes('gemini-3');

      if (isReasoningModel) {
        // Deep mode gets a larger budget, Fast (concise) gets a smaller one
        generationConfig.thinkingConfig = {
          includeThoughts: true,
          thinkingBudget: thinkingMode === 'deep' ? 16000 : 4000
        };
      }

      const result = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: generationConfig,
        tools: tools
      } as any);

      let buffer = "";
      let inThinkingBlock = false;

      for await (const chunk of result) {
        // 1. Check for native reasoning/thought parts (Standard in newer Gemini Thinking models)
        const parts = chunk.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          // Note: 'thoughtSignature' is just a cryptographic hash, NOT the actual thought content
          // Only 'thought: true' parts with text contain actual reasoning (models like gemini-2.0-flash-thinking)
          if ((part as any).thought === true) {
            const thoughtText = (part as any).text || "";
            if (thoughtText) yield { thinkingDelta: thoughtText };
            continue;
          }
        }

        const chunkText = chunk.text || "";
        if (!chunkText) continue;

        // 2. Manual parsing for models that wrap with tags instead of using native parts
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

    // --- DEEPSEEK & OPENAI STREAMING ---
    else if (provider === 'deepseek' || provider === 'openai') {
      const baseUrl = provider === 'deepseek' ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1";
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${baseUrl}/chat/completions`,
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          },
          body: {
            model: model,
            messages: [
              { role: "system", content: systemInstructionText },
              ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
              { role: "user", content: userContext }
            ],
            stream: true
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `${provider} Error: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let hasReceivedContent = false;

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
              if (content) {
                yield { textDelta: content };
                hasReceivedContent = true;
              }
            } catch (e) { }
          }
        }
      }

      if (!hasReceivedContent) {
        throw new Error("No response generated. The model may be overloaded or the request timed out.");
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

    // Diagnostic: If 404, try to list models to console
    if (msg.includes("404") && provider === 'google') {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.list();
        console.warn("DIAGNOSTIC - Available Models for your key:");
        // Some SDK versions return a pager, some return an object with models
        const modelList = (result as any).models || result;
        if (modelList && typeof modelList.forEach === 'function') {
          modelList.forEach((m: any) => console.warn(` - ${m.name}`));
        }
        msg += " (Model not found. Available models listed in console)";
      } catch (e) { }
    }

    if (msg.includes("Failed to fetch")) {
      msg += " (Network error or CORS block. Check API Key and Internet)";
    }
    yield { textDelta: `\n\n[Error: ${msg}]` };
  }
}
