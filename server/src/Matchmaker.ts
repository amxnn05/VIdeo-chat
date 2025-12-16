import { v4 as uuidv4 } from 'uuid';

interface User {
	id: string;
	name: string;
	lastPoll: number;
	partnerId: string | null;
	agoraChannel: string | null;
	isInitiator: boolean;
}

export class Matchmaker {
	private queue: string[] = [];
	private users: Map<string, User> = new Map();
	private CLEANUP_INTERVAL = 5000; // 5 seconds
	private USER_TIMEOUT = 10000; // 10 seconds timeout for inactive users

	constructor() {
		// Cleanup interval to remove inactive users
		setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
	}

	public joinQueue(name: string): { userId: string } {
		const userId = uuidv4();
		const user: User = {
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

	public poll(userId: string): {
		status: 'waiting' | 'matched',
		partnerName?: string,
		agoraChannel?: string,
		token?: string | null
	} | null {
		const user = this.users.get(userId);
		if (!user) return null;

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
				agoraChannel: user.agoraChannel!,
				token: null // In a real app, generate Agora token here
			};
		}

		return { status: 'waiting' };
	}

	public leave(userId: string) {
		this.handleDisconnect(userId);
	}

	private tryMatch() {
		if (this.queue.length >= 2) {
			const user1Id = this.queue.shift()!;
			const user2Id = this.queue.shift()!;

			const user1 = this.users.get(user1Id);
			const user2 = this.users.get(user2Id);

			if (!user1 || !user2) {
				// One of them might have disconnected in the meantime
				if (user1) this.queue.unshift(user1Id);
				if (user2) this.queue.unshift(user2Id);
				return;
			}

			const channelName = uuidv4();

			user1.partnerId = user2Id;
			user1.agoraChannel = channelName;
			user1.isInitiator = true;

			user2.partnerId = user1Id;
			user2.agoraChannel = channelName;
			user2.isInitiator = false;

			console.log(`Matched ${user1.name} with ${user2.name} in channel ${channelName}`);
		}
	}

	private handleDisconnect(userId: string) {
		const user = this.users.get(userId);
		if (!user) return;

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

	private cleanup() {
		const now = Date.now();
		for (const [userId, user] of this.users.entries()) {
			if (now - user.lastPoll > this.USER_TIMEOUT) {
				this.handleDisconnect(userId);
			}
		}
	}
}
