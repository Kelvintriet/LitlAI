"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Tavily API endpoint
const TAVILY_API_URL = "https://api.tavily.com/search";

export const search = action({
    args: {
        query: v.string(),
        mode: v.optional(v.string()) // 'search' or 'extract' (not crawl per user request)
    },
    handler: async (ctx, { query, mode = "search" }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            throw new Error("TAVILY_API_KEY is not set");
        }

        try {
            // Basic Search
            const response = await fetch(TAVILY_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: query,
                    search_depth: mode === "extract" ? "advanced" : "basic",
                    include_answer: true,
                    max_results: 5,
                    topic: "general",
                    include_images: false,
                    include_raw_content: mode === "extract", // If extract mode, get raw content
                }),
            });

            if (!response.ok) {
                throw new Error(`Tavily API failed with status ${response.status}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error("Tavily search error:", error);
            throw new Error("Failed to perform search: " + (error instanceof Error ? error.message : String(error)));
        }
    },
});
