import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const getGroqKey = () => {
    const keys = [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
    ].filter(Boolean);

    if (keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
};

export const chat = action({
    args: {
        message: v.string(),
        userId: v.id("users"),
        conversationId: v.id("conversations"),
        tools: v.optional(v.array(v.string())),
        model: v.optional(v.string()),
        isGuest: v.optional(v.boolean()),
        guestHistory: v.optional(v.array(v.object({ role: v.string(), content: v.string() })))
    },
    handler: async (ctx, { message, userId, conversationId, tools, model, isGuest, guestHistory }) => {
        const apiKey = getGroqKey();
        if (!apiKey) {
            throw new Error("No GROQ_API_KEY found in environment variables");
        }

        // Declare message ID variable to be shared across scopes
        let aiMessageId;

        // 1. Fetch context
        let context = [];
        if (isGuest && guestHistory) {
            context = guestHistory.map(m => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content
            }));
        } else {
            const history = await ctx.runQuery(api.messages.list, { conversationId });
            console.log("History length:", history.length);
            context = history.slice(-20).map(m => ({
                role: m.author === "user" ? "user" : "assistant",
                content: m.body
            }));
        }

        // 2. Handle Tools Logic
        if (tools) {
            // Code Interpreter System Prompt
            if (tools.includes('code_interpreter')) {
                const codePrompt = "You have access to a Python 3 code interpreter. " +
                    "To solve calculations, data processing, or logic tasks, WRITE PYTHON CODE " +
                    "inside a markdown block like ```python ... ```. " +
                    "The code will be executed and the output shown to the user. " +
                    "Use print() to output results.";
                context.unshift({ role: "system", content: codePrompt });
            }

            // Canvas Logic
            if (tools.includes('canvas')) {
                const canvasPrompt = "You can generate standalone content blocks called 'Canvas'. " +
                    "Use <canvas type=\"widget\" title=\"Title\">CONTENT</canvas> for short items (emails, single functions, brief notes). " +
                    "Use <canvas type=\"sidebar\" title=\"Title\">CONTENT</canvas> for long articles, complex code files (e.g. over 15 lines), or full documents. " +
                    "The user can edit these blocks directly. DO NOT wrap the content inside the tags with markdown code blocks unless it is part of the content itself. " +
                    "Choose 'widget' for quick items that don't need a full sidebar, and 'sidebar' for deep work.";
                context.unshift({ role: "system", content: canvasPrompt });
            }

            // Search Logic
            if (tools.includes('search')) {
                const tavilyKey = process.env.TAVILY_API_KEY;
                if (!tavilyKey) {
                    throw new Error("TAVILY_API_KEY is not set");
                }

                let query = message;
                let mode = "search";

                // Step A: Try to Plan Search
                try {
                    const plannerPrompt = [
                        ...context,
                        { role: "user", content: message },
                        { role: "system", content: "You are a search optimizer. Based on the user's last message, output a JSON object with two fields: 'query' (the best search query to find the answer) and 'mode' (either 'search' or 'extract'). Output ONLY valid JSON." }
                    ];

                    const planResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "groq/compound",
                            messages: plannerPrompt,
                            stream: false,
                            response_format: { type: "json_object" }
                        }),
                    });

                    const planData = await planResponse.json();
                    if (planData.choices && planData.choices.length > 0) {
                        let planContent = planData.choices[0].message.content;
                        if (planContent.includes("```json")) {
                            planContent = planContent.replace(/```json/g, "").replace(/```/g, "");
                        }
                        const searchPlan = JSON.parse(planContent);
                        if (searchPlan.query) query = searchPlan.query;
                        if (searchPlan.mode) mode = searchPlan.mode;
                    }
                } catch (e) {
                    console.error("Search planning failed:", e);
                }

                // Initialize AI message early
                aiMessageId = await ctx.runMutation(api.messages.send, {
                    body: `Searching with query: "${query}"...`,
                    author: "ai",
                    userId,
                    conversationId,
                });

                // Step B: Execute Tavily Search
                try {
                    const searchResponse = await fetch("https://api.tavily.com/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            api_key: tavilyKey,
                            query: query,
                            search_depth: mode === "extract" ? "advanced" : "basic",
                            include_answer: true,
                            max_results: 5,
                            include_raw_content: mode === "extract"
                        })
                    });
                    const searchResults = await searchResponse.json();

                    const resultsData = searchResults.results || [];
                    const contextString = JSON.stringify(resultsData);

                    context.unshift({
                        role: "system",
                        content: `Search Results for "${query}" (Mode: ${mode}):\n${contextString}\n\n` +
                            `INSTRUCTIONS: Use the provided search results to answer the user. ` +
                            `ALWAYS cite your sources inline or at the end using markdown links with the format [[Title](URL)]. ` +
                            `Ensure the URLs match the 'url' field in the provided JSON.`
                    });
                } catch (e) {
                    console.error("Tavily search failed:", e);
                }
            }
        }

        // 3. Add current message to context
        context.push({ role: "user", content: message });

        // 4. Initialize AI message if not guest & not created
        if (!isGuest && !aiMessageId) {
            aiMessageId = await ctx.runMutation(api.messages.send, {
                body: "",
                author: "ai",
                userId,
                conversationId,
            });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model || "groq/compound",
                messages: context,
                stream: true,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Groq API error: ${error}`);
        }

        // 5. Handle Streaming
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let lastUpdate = Date.now();

        if (reader) {
            // Smart Naming - skip for guest, run in background if first message
            if (!isGuest && context.length <= 1) {
                ctx.runAction(api.groq.generateTitle, {
                    message,
                    conversationId
                }).catch(e => console.error("Naming failed", e));
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === "[DONE]") break;

                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || "";
                            fullResponse += content;

                            if (aiMessageId && Date.now() - lastUpdate > 100) {
                                await ctx.runMutation(api.messages.update, {
                                    messageId: aiMessageId,
                                    body: fullResponse
                                });
                                lastUpdate = Date.now();
                            }
                        } catch (e) { }
                    }
                }
            }

            if (aiMessageId) {
                await ctx.runMutation(api.messages.update, {
                    messageId: aiMessageId,
                    body: fullResponse
                });
            }
        }

        return fullResponse;
    },
});

export const generateTitle = action({
    args: {
        message: v.string(),
        conversationId: v.id("conversations"),
    },
    handler: async (ctx, { message, conversationId }) => {
        console.log("Generating title for chat:", conversationId);
        const apiKey = getGroqKey();
        if (!apiKey) {
            console.error("GROQ_API_KEY missing in generateTitle");
            return;
        }

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "You are a specialized title generator. Based on the user's prompt, generate a VERY short, catchy title (max 4 words). Output ONLY the title, no quotes or punctuation." },
                        { role: "user", content: message }
                    ],
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error("Groq Title error:", error);
                return;
            }

            const data = await response.json();
            const rawTitle = data.choices[0]?.message?.content || "";
            const title = rawTitle.trim().replace(/^"|"$/g, "");
            console.log("Generated Title:", title);

            if (title) {
                await ctx.runMutation(api.conversations.update, {
                    conversationId,
                    title
                });
            }
        } catch (e) {
            console.error("Smart naming failed:", e);
        }
    }
});
