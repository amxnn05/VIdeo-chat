"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Matchmaker = void 0;
const uuid_1 = require("uuid");
class Matchmaker {
    constructor() {
        this.queue = [];
        this.users = new Map();
        this.CLEANUP_INTERVAL = 5000; // 5 seconds
        this.USER_TIMEOUT = 10000; // 10 seconds timeout for inactive users
        // Cleanup interval to remove inactive users
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
    joinQueue(name) {
        const userId = (0, uuid_1.v4)();
        const user = {
            id: userId,
            name: name || 'Stranger',
            lastPoll: Date.now(),
            partnerId: null,
            agoraChannel: null,
            isInitiator: false
        };
        this.users.set(userId, user);
        this.queue.push(userId);
        this.tryMatch();
        console.log(`User joined: ${userId} (${user.name})`);
        return { userId };
    }
    poll(userId) {
        const user = this.users.get(userId);
        if (!user)
            return null;
        user.lastPoll = Date.now();
        if (user.partnerId) {
            const partner = this.users.get(user.partnerId);
            if (!partner) {
                // Partner disappeared
                this.handleDisconnect(user.partnerId); // Ensure cleanup
                user.partnerId = null;
                user.agoraChannel = null;
                this.queue.push(userId); // Re-queue
                return { status: 'waiting' };
            }
            return {
                status: 'matched',
                partnerName: partner.name,
                agoraChannel: user.agoraChannel,
                token: null // In a real app, generate Agora token here
            };
        }
        return { status: 'waiting' };
    }
    leave(userId) {
        this.handleDisconnect(userId);
    }
    tryMatch() {
        if (this.queue.length >= 2) {
            const user1Id = this.queue.shift();
            const user2Id = this.queue.shift();
            const user1 = this.users.get(user1Id);
            const user2 = this.users.get(user2Id);
            if (!user1 || !user2) {
                // One of them might have disconnected in the meantime
                if (user1)
                    this.queue.unshift(user1Id);
                if (user2)
                    this.queue.unshift(user2Id);
                return;
            }
            const channelName = (0, uuid_1.v4)();
            user1.partnerId = user2Id;
            user1.agoraChannel = channelName;
            user1.isInitiator = true;
            user2.partnerId = user1Id;
            user2.agoraChannel = channelName;
            user2.isInitiator = false;
            console.log(`Matched ${user1.name} with ${user2.name} in channel ${channelName}`);
        }
    }
    handleDisconnect(userId) {
        const user = this.users.get(userId);
        if (!user)
            return;
        // Remove from queue
        this.queue = this.queue.filter(id => id !== userId);
        // Notify partner if matched
        if (user.partnerId) {
            const partner = this.users.get(user.partnerId);
            if (partner) {
                partner.partnerId = null;
                partner.agoraChannel = null;
                // We don't automatically re-queue the partner here, 
                // the poll response will handle it when they see partner is gone
                // or we can re-queue them immediately? 
                // Let's let the poll logic handle it to avoid race conditions.
                // Actually, for better UX, let's just clear the link.
            }
        }
        this.users.delete(userId);
        console.log(`User disconnected/removed: ${userId}`);
    }
    cleanup() {
        const now = Date.now();
        for (const [userId, user] of this.users.entries()) {
            if (now - user.lastPoll > this.USER_TIMEOUT) {
                this.handleDisconnect(userId);
            }
        }
    }
}
exports.Matchmaker = Matchmaker;
