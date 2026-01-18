"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const execute = action({
    args: {
        source: v.string(),
        language: v.optional(v.string()), // default python
    },
    handler: async (ctx, { source, language = "python" }) => {
        try {
            const response = await fetch("https://emkc.org/api/v2/piston/execute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    language: language,
                    version: "*", // Use latest available
                    files: [
                        {
                            content: source,
                        },
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(`Piston API failed with status ${response.status}`);
            }

            const result = await response.json();
            return {
                run: result.run,
                // language: result.language,
                // version: result.version
            };
        } catch (error) {
            console.error("Piston execution error:", error);
            throw new Error("Failed to execute code: " + (error instanceof Error ? error.message : String(error)));
        }
    },
});
