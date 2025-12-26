import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';

interface User {
	id: string;
	socketId: string;
	name: string;
	partnerSocketId: string | null;
	agoraChannel: string | null;
	isInitiator: boolean;
}

export class Matchmaker {
	private queue: string[] = []; // socketIds
	private users: Map<string, User> = new Map(); // socketId -> User
	private io: Server;

	constructor(io: Server) {
		this.io = io;
	}

	public handleConnection(socket: Socket) {
		console.log(`User connected: ${socket.id}`);

		socket.on('join_queue', (data: { name: string }) => {
			this.joinQueue(socket.id, data.name);
		});

		socket.on('disconnect', () => {
			this.handleDisconnect(socket.id);
		});

		socket.on('leave_queue', () => {
			this.handleDisconnect(socket.id);
		});

		// WebRTC Signaling
		socket.on('signal', (data: any) => {
			const user = this.users.get(socket.id);
			if (user && user.partnerSocketId) {
				this.io.to(user.partnerSocketId).emit('signal', data);
			}
		});

		// Chat Messages
		socket.on('chat_message', (data: { text: string }) => {
			const user = this.users.get(socket.id);
			console.log(`Chat message from ${socket.id} to ${user?.partnerSocketId}: ${data.text}`);
			if (user && user.partnerSocketId) {
				this.io.to(user.partnerSocketId).emit('chat_message', {
					text: data.text,
					sender: 'stranger' // Received from stranger
				});
			} else {
				console.log(`User ${socket.id} has no partner to chat with.`);
			}
		});
	}

	private joinQueue(socketId: string, name: string) {
		// If already in queue/users, update or ignore
		if (this.users.has(socketId)) {
			// Possibly updating name or re-joining?
			// For simplicity, treat as new join
			this.handleDisconnect(socketId);
		}

		console.log(`User joining queue: ${socketId} (${name})`);

		const user: User = {
			id: uuidv4(),
			socketId: socketId,
			name: name || 'Stranger',
			partnerSocketId: null,
			agoraChannel: null,
			isInitiator: false
		};

		this.users.set(socketId, user);
		this.queue.push(socketId);
		this.tryMatch();
	}

	private tryMatch() {
		// Filter out disconnected sockets just in case
		this.queue = this.queue.filter(id => this.users.has(id));

		if (this.queue.length >= 2) {
			const socket1Id = this.queue.shift()!;
			const socket2Id = this.queue.shift()!;

			const user1 = this.users.get(socket1Id);
			const user2 = this.users.get(socket2Id);

			if (!user1 || !user2) {
				// Should not happen due to filter above, but safety check
				if (user1) this.queue.unshift(socket1Id);
				if (user2) this.queue.unshift(socket2Id);
				return;
			}

			const channelName = uuidv4();

			user1.partnerSocketId = socket2Id;
			user1.agoraChannel = channelName;
			user1.isInitiator = true;

			user2.partnerSocketId = socket1Id;
			user2.agoraChannel = channelName;
			user2.isInitiator = false;

			console.log(`Matched ${user1.name} (${socket1Id}) with ${user2.name} (${socket2Id})`);

			// Emit match events
			this.io.to(socket1Id).emit('match_found', {
				partnerName: user2.name,
				agoraChannel: channelName,
				isInitiator: true,
				token: null // Generate real token if needed
			});

			this.io.to(socket2Id).emit('match_found', {
				partnerName: user1.name,
				agoraChannel: channelName,
				isInitiator: false,
				token: null
			});
		}
	}

	private handleDisconnect(socketId: string) {
		const user = this.users.get(socketId);
		if (!user) return;

		console.log(`User disconnected/left: ${socketId}`);

		// Remove from queue
		this.queue = this.queue.filter(id => id !== socketId);
		this.users.delete(socketId);

		// Notify partner
		if (user.partnerSocketId) {
			const partner = this.users.get(user.partnerSocketId);
			if (partner) {
				// Notify partner their stranger left
				this.io.to(user.partnerSocketId).emit('partner_disconnected');

				// Reset partner state
				partner.partnerSocketId = null;
				partner.agoraChannel = null;
				partner.isInitiator = false;

				// Optional: Automatically re-queue them?
				// Usually Omegle just stops and asks 'New Chat?'
				// We'll let client handle 'New Chat' click.
			}
		}
	}
}

