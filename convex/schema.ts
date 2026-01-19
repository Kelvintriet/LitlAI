import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        username: v.string(),
        passwordHash: v.optional(v.string()),
        isGuest: v.optional(v.boolean()),
        messageCount: v.optional(v.number()),
        customInstructions: v.optional(v.string()), // User personalization
        smartAutoTools: v.optional(v.boolean()), // Preference for Smart Auto
    }).index("by_username", ["username"]),

    conversations: defineTable({
        title: v.string(),
        userId: v.id("users"),
    }).index("by_userId", ["userId"]),

    messages: defineTable({
        body: v.string(),
        author: v.string(), // "user" or "ai"
        userId: v.optional(v.id("users")),
        conversationId: v.optional(v.id("conversations")),
        canvasId: v.optional(v.id("canvases")),
        model: v.optional(v.string()), // Track which AI model generated this message
        timestamp: v.number(),
    }).index("by_conversationId", ["conversationId"]),

    canvases: defineTable({
        title: v.string(),
        content: v.string(),
        type: v.string(), // "widget" | "sidebar"
        userId: v.id("users"),
        conversationId: v.id("conversations"),
        lastModified: v.number(),
    }).index("by_conversationId", ["conversationId"]),
});
