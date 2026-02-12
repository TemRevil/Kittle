import { GoogleGenAI } from "@google/genai";
import { FileContext, Message, LLMConfig, ThinkingMode, MODEL_PRICING } from "../types";
import { estimateTokens } from "../utils";

export interface StreamUpdate {
  textDelta?: string;
  thinkingDelta?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  done?: boolean;
  error?: {
    type: 'quota' | 'key' | 'network' | 'model' | 'unknown';
    message: string;
  };
}

export async function* streamLLMResponse(
  config: LLMConfig,
  currentMessage: string,
  history: Message[],
  activeFiles: FileContext[],
  githubLink: string,
  thinkingMode: ThinkingMode,
  isSearchEnabled: boolean,
  isDesignMode: boolean,
  isFullRepoMode: boolean = false,
  repoTree: any[] = [],
  allFiles: FileContext[] = [],
  signal?: AbortSignal
): AsyncGenerator<StreamUpdate, void, unknown> {
  const { provider, model, apiKeys } = config;

  // Repo Tree Formatting Helper
  const formatRepoTree = (nodes: any[], depth = 0): string => {
    let out = "";
    for (const node of nodes) {
      const indent = "  ".repeat(depth);
      out += `${indent}${node.name}${node.type === 'tree' ? '/' : ''}\n`;
      if (node.children) out += formatRepoTree(node.children, depth + 1);
    }
    return out;
  };
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
    systemLines.push("MODE: FAST/CONCISE. Be direct. Avoid fluff. Provide code solutions immediately.");
  } else {
    systemLines.push("### MODE: EXTREME DEEP REASONING (STRICT) ###");
    systemLines.push("You are in a high-priority 'Deep Reasoning' state. The user expects exhaustive, professional, and technical excellence.");
    systemLines.push("CRITICAL INSTRUCTIONS:");
    systemLines.push("1. EXTREME CHAIN-OF-THOUGHT: You MUST take your time. Analyze every possible angle. Break down the task into recursive logical steps.");
    systemLines.push("2. NO HALLUCINATIONS: You have the file structure but NOT all content. PROHIBITED from guessing content of unread files. If you need content, ASK for it.");
    systemLines.push("3. EXHAUSTIVE DETAIL: Provide extremely detailed 'Why' and 'How'. Do not summarize. The user wants the 'long' version.");
    systemLines.push("4. BREADTH & DEPTH: Consider security, performance, scalability, and code maintainability simultaneously.");
    systemLines.push("5. MULTI-STEP VERIFICATION: Mentally run your code before outputting. Verify its integration with the existing project structure.");
  }

  if (isSearchEnabled) {
    systemLines.push("SEARCH: You have access to Google Search. Use it for current events/docs.");
  }

  // Check if model supports complex visual reasoning
  const capableVisualModels = ['gemini', 'gpt-4', 'claude-3', 'sonnet', 'opus', 'o1', 'deepseek', 'f1', 'openrouter'];
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
      systemLines.push("FLEXIBILITY: You CAN create multiple diagrams in one response if needed.");
      systemLines.push("CRITICAL FOR MERMAID FLOWCHARTS:");
      systemLines.push("1. Use ONLY graph TD or graph LR.");
      systemLines.push("2. USE DOUBLE QUOTES for ALL labels (nodes and edges). Example: A[\"Node Label\"] --> |\"Edge Label\"| B[\"Another Label\"].");
      systemLines.push("3. NO SPECIAL CHARS in Node IDs: Use alphanumeric IDs only (e.g., Node1, AppServer).");
      systemLines.push("4. PARENTHESES: Never use () in labels UNLESS they are inside double quotes. This causes immediate Parse Errors.");
    } else {
      systemLines.push("### VISUAL MODE REQUESTED ###");
      systemLines.push("NOTE: The user has requested visual diagrams, but this model may be less optimized for generation.");
      systemLines.push("Try your best to use Mermaid.js (```mermaid) for structures.");
      systemLines.push("CRITICAL FOR MERMAID SYNTAX:");
      systemLines.push("1. ALWAYS use double quotes for labels: A[\"My Label (Safe)\"].");
      systemLines.push("2. Keep node IDs simple (e.g., A, B, C or AuthNode).");
      systemLines.push("3. For edge labels with special characters like (), use: A --> |\"Label (Risk D)\"| B.");
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

  if (isFullRepoMode && repoTree.length > 0) {
    const treeString = formatRepoTree(repoTree);
    console.groupCollapsed(`[LLM] 👁️ Full Repo Context (Structure) - ${repoTree.length} root items`);
    console.log(treeString);
    console.groupEnd();

    systemLines.push("### FULL REPO CONTEXT (STRUCTURE ONLY) ###");
    systemLines.push("The text below shows the COMPLETE file structure of the connected repository.");
    systemLines.push("IMPORTANT: You do NOT have the content of these files, only their names/paths.");
    systemLines.push("Use this to understand the project architecture or to tell the user which specific files you need to read to answer their question.");
    systemLines.push("FILE TREE:");
    systemLines.push(treeString);
  }

  if (activeFiles.length > 0) {
    console.log(`[LLM] 📂 Attached Files (Content Sent):`, activeFiles.map(f => f.name));
    systemLines.push("CRITICAL CONTEXT: The user has attached specific files. You MUST read and analyze these files deeply.");
    systemLines.push("Refuse to hallucinate. If the answer is in the files, cite it. If not, say so.");
  }

  // Helper to build a transcript part for history including files/thoughts
  const buildTranscript = (msg: Message): string => {
    let content = "";
    if (msg.role === 'user' && msg.relatedFiles && msg.relatedFiles.length > 0) {
      content += `Attached Files:\n`;
      msg.relatedFiles.forEach(path => {
        const file = allFiles.find(f => f.name === path);
        if (file && (file.category === 'code' || file.category === 'other')) {
          content += `\n--- START FILE: ${file.name} ---\n${file.content}\n--- END FILE ---\n`;
        }
      });
    }

    if (msg.role === 'model' && msg.thinking) {
      content += `<thinking>\n${msg.thinking}\n</thinking>\n\n`;
    }

    content += msg.text;
    return content;
  };

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

  if (isDesignMode) {
    userContext += `\n\n[SYSTEM INSTRUCTION]: Visual Design Mode is ENABLED. If relevant, you may generate mermaid diagrams using \`\`\`mermaid code blocks.`;
  }
  // Calculate prompt tokens
  const promptTokens = estimateTokens(systemInstructionText) +
    history.reduce((acc, m) => acc + estimateTokens(m.text) + estimateTokens(m.thinking || ""), 0) +
    estimateTokens(userContext);

  let completionText = "";
  let completionThinking = "";

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
        parts: [{ text: buildTranscript(msg) }]
      }));

      // Create the current user message parts
      const currentParts: any[] = [{ text: userContext }];

      // Add images to the current message if any (Gemini supports: png, jpeg, webp, heic, heif)
      const supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
      activeFiles
        .filter(f => f.category === 'image' && supportedImageTypes.includes(f.type.toLowerCase()))
        .forEach(f => {
          const mimeType = f.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : f.type;
          currentParts.push({ inlineData: { mimeType, data: f.content } });
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
          thinkingBudget: thinkingMode === 'deep' ? 64000 : 8000
        };
        generationConfig.maxOutputTokens = thinkingMode === 'deep' ? 128000 : 16384;
      }

      const result = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: generationConfig,
        tools: tools,
        requestOptions: { signal }
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
            if (thoughtText) {
              completionThinking += thoughtText;
              yield { thinkingDelta: thoughtText };
            }
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
              if (content) {
                completionThinking += content;
                yield { thinkingDelta: content };
              }
              buffer = "";
            } else if (buffer.length > 50) {
              const safePart = buffer.slice(0, -15);
              if (safePart) {
                completionThinking += safePart;
                yield { thinkingDelta: safePart };
                buffer = buffer.slice(-15);
              }
            }
          } else {
            if (buffer.endsWith("<thinking>")) {
              inThinkingBlock = true;
              const content = buffer.slice(0, -10);
              if (content) {
                completionText += content;
                yield { textDelta: content };
              }
              buffer = "";
            } else if (!buffer.includes("<") || buffer.length > 20) {
              if (buffer.includes("<") && !buffer.includes("<thinking") && buffer.length > 15) {
                completionText += buffer;
                yield { textDelta: buffer };
                buffer = "";
              } else if (!buffer.includes("<")) {
                completionText += buffer;
                yield { textDelta: buffer };
                buffer = "";
              }
            }
          }
        }
      }

      if (buffer) {
        if (inThinkingBlock) {
          const t = buffer.replace("</thinking>", "");
          completionThinking += t;
          yield { thinkingDelta: t };
        }
        else {
          completionText += buffer;
          yield { textDelta: buffer };
        }
      }

      const completionTokens = estimateTokens(completionText) + estimateTokens(completionThinking);
      yield {
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        done: true
      };
    }

    // --- DEEPSEEK, OPENAI & OPENROUTER STREAMING ---
    else if (provider === 'deepseek' || provider === 'openai' || provider === 'openrouter') {
      let baseUrl = "";
      if (provider === 'deepseek') baseUrl = "https://api.deepseek.com/v1";
      else if (provider === 'openrouter') baseUrl = "https://openrouter.ai/api/v1";
      else baseUrl = "https://api.openai.com/v1";

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          ...(provider === 'openrouter' ? {
            "HTTP-Referer": window.location.origin,
            "X-Title": "Kittle AI"
          } : {})
        },
        signal: signal,
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemInstructionText },
            ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: buildTranscript(m) })),
            { role: "user", content: userContext }
          ],
          stream: true
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
              const thinking = json.choices[0]?.delta?.reasoning_content;

              if (thinking) {
                completionThinking += thinking;
                yield { thinkingDelta: thinking };
                hasReceivedContent = true;
              }
              if (content) {
                completionText += content;
                yield { textDelta: content };
                hasReceivedContent = true;
              }
            } catch (e) { }
          }
        }
      }

      if (hasReceivedContent) {
        const completionTokens = estimateTokens(completionText);
        yield {
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens
          },
          done: true
        };
      } else {
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
        signal: signal, // CORRECT: signal is part of fetch options
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [
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
                completionText += json.delta.text;
                yield { textDelta: json.delta.text };
              }
            } catch (e) { }
          }
        }
      }

      const completionTokens = estimateTokens(completionText);
      yield {
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        done: true
      };
    }

  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log("[LLM] Stream aborted by user.");
      return;
    }
    let msg = error.message || "Failed to fetch response";
    let type: 'quota' | 'key' | 'network' | 'model' | 'unknown' = 'unknown';

    // Handle Quota Errors (429)
    if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded") || msg.toLowerCase().includes("resource_exhausted")) {
      type = 'quota';
      msg = "API Quota Exceeded. Please try a different model (like Gemini 2.5 Flash) or wait a few minutes.";
    }

    // Diagnostic: If 404, try to list models to console
    if (msg.includes("404") && provider === 'google') {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.list();
        console.warn("DIAGNOSTIC - Available Models for your key:");
        const modelList = (result as any).models || result;
        if (modelList && typeof modelList.forEach === 'function') {
          modelList.forEach((m: any) => console.warn(` - ${m.name}`));
        }
        msg += " (Model not found. Available models listed in console)";
        type = 'model';
      } catch (e) { }
    }

    if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("invalid_key")) {
      type = 'key';
    }

    if (msg.includes("Failed to fetch") || msg.includes("network")) {
      msg += " (Network error or CORS block. Check API Key and Internet)";
      type = 'network';
    }

    yield {
      error: { type, message: msg },
      textDelta: `\n\n[Error: ${msg}]`
    };
  }
}
