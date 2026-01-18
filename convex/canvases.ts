import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        type: v.string(),
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("canvases", {
            ...args,
            lastModified: Date.now(),
        });
    },
});

export const update = mutation({
    args: {
        canvasId: v.id("canvases"),
        content: v.string(),
        title: v.optional(v.string()),
    },
    handler: async (ctx, { canvasId, content, title }) => {
        const patch: any = { content, lastModified: Date.now() };
        if (title) patch.title = title;
        await ctx.db.patch(canvasId, patch);
    },
});

export const get = query({
    args: { canvasId: v.id("canvases") },
    handler: async (ctx, { canvasId }) => {
        return await ctx.db.get(canvasId);
    },
});
