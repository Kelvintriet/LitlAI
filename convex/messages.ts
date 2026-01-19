import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { conversationId: v.optional(v.id("conversations")) },
    handler: async (ctx, { conversationId }) => {
        if (!conversationId) return [];
        return await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
            .order("asc")
            .collect();
    },
});

export const send = mutation({
    args: {
        body: v.string(),
        author: v.string(),
        userId: v.id("users"),
        conversationId: v.id("conversations"),
        model: v.optional(v.string())
    },
    handler: async (ctx, { body, author, userId, conversationId, model }) => {
        return await ctx.db.insert("messages", {
            body,
            author,
            userId,
            conversationId,
            model,
            timestamp: Date.now(),
        });
    },
});

export const update = mutation({
    args: {
        messageId: v.id("messages"),
        body: v.string(),
    },
    handler: async (ctx, { messageId, body }) => {
        await ctx.db.patch(messageId, { body });
    },
});

export const clear = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, { conversationId }) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
            .collect();
        for (const msg of messages) {
            await ctx.db.delete(msg._id);
        }
    },
});
