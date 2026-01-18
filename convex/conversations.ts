import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: { title: v.string(), userId: v.id("users") },
    handler: async (ctx, { title, userId }) => {
        return await ctx.db.insert("conversations", {
            title,
            userId,
        });
    },
});

export const list = query({
    args: { userId: v.union(v.id("users"), v.null()) },
    handler: async (ctx, { userId }) => {
        if (!userId) return [];
        return await ctx.db
            .query("conversations")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    },
});

export const remove = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, { conversationId }) => {
        // Also delete all messages in this conversation
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
            .collect();
        for (const msg of messages) {
            await ctx.db.delete(msg._id);
        }
        await ctx.db.delete(conversationId);
    },
});

export const update = mutation({
    args: { conversationId: v.id("conversations"), title: v.string() },
    handler: async (ctx, { conversationId, title }) => {
        await ctx.db.patch(conversationId, { title });
    },
});

export const get = query({
    args: { conversationId: v.union(v.id("conversations"), v.null()) },
    handler: async (ctx, { conversationId }) => {
        if (!conversationId) return null;
        return await ctx.db.get(conversationId);
    },
});
