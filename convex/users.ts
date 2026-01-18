import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const signup = mutation({
    args: { username: v.string(), password: v.string() },
    handler: async (ctx, { username, password }) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", username))
            .unique();

        if (existing) {
            throw new Error("Username already exists");
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const userId = await ctx.db.insert("users", {
            username,
            passwordHash,
        });

        return userId;
    },
});

export const login = mutation({
    args: { username: v.string(), password: v.string() },
    handler: async (ctx, { username, password }) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", username))
            .unique();

        if (!user) {
            throw new Error("Invalid username or password");
        }
        if (!user.passwordHash) {
            throw new Error("Invalid account type");
        }

        const valid = bcrypt.compareSync(password, user.passwordHash);
        if (!valid) {
            throw new Error("Invalid username or password");
        }

        return user._id;
    },
});

export const createGuest = mutation({
    args: {},
    handler: async (ctx) => {
        const guestId = await ctx.db.insert("users", {
            username: `guest_${Math.random().toString(36).slice(2, 9)}`,
            isGuest: true,
            messageCount: 0
        });
        return guestId;
    }
});

export const incrementMessageCount = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, { userId }) => {
        const user = await ctx.db.get(userId);
        if (user && user.isGuest) {
            await ctx.db.patch(userId, {
                messageCount: (user.messageCount || 0) + 1
            });
        }
    }
});

export const get = query({
    args: { userId: v.union(v.id("users"), v.null()) },
    handler: async (ctx, { userId }) => {
        if (!userId) return null;
        return await ctx.db.get(userId);
    },
});
