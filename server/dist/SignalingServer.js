"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingServer = void 0;
const socket_io_1 = require("socket.io");
const Matchmaker_1 = require("./Matchmaker");
const Filter = require('bad-words');
class SignalingServer {
    constructor(httpServer) {
        this.bannedUsers = new Set(); // In-memory ban list (socket ID or IP)
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });
        this.matchmaker = new Matchmaker_1.Matchmaker(this.io);
        this.filter = new Filter();
        this.initializeSocketEvents();
    }
    initializeSocketEvents() {
        this.io.on('connection', (socket) => {
            const clientIp = socket.handshake.address;
            // Check if user is banned
            if (this.bannedUsers.has(clientIp)) {
                console.log(`Banned user tried to connect: ${clientIp}`);
                socket.emit('banned', { reason: 'You are banned from this server.' });
                socket.disconnect();
                return;
            }
            console.log(`User connected: ${socket.id}`);
            socket.on('start_chat', (data) => {
                this.matchmaker.addToQueue(socket.id, data.name || 'Stranger');
            });
            socket.on('offer', (data) => {
                this.io.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
            });
            socket.on('answer', (data) => {
                this.io.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
            });
            socket.on('ice_candidate', (data) => {
                this.io.to(data.to).emit('ice_candidate', { from: socket.id, candidate: data.candidate });
            });
            socket.on('chat_message', (data) => {
                if (this.filter.isProfane(data.message)) {
                    console.log(`User ${socket.id} sent profane message: ${data.message}`);
                    this.banUser(socket, clientIp, 'Profanity in chat');
                    return;
                }
                this.io.to(data.to).emit('chat_message', { from: socket.id, message: data.message });
            });
            socket.on('report_user', (data) => {
                // Allow users to report their partner (e.g. for video content)
                // For now, we'll just log it, but in a real app this would trigger a review or auto-ban
                console.log(`User ${socket.id} reported partner for: ${data.reason}`);
            });
            socket.on('ban_me', (data) => {
                // Self-report from client-side AI
                console.log(`User ${socket.id} self-reported (AI detection): ${data.reason}`);
                this.banUser(socket, clientIp, data.reason);
            });
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
                this.matchmaker.handleDisconnect(socket.id);
            });
            socket.on('next_chat', (data) => {
                this.matchmaker.handleDisconnect(socket.id); // Treat as disconnect from current chat
                this.matchmaker.addToQueue(socket.id, data.name || 'Stranger');
            });
        });
    }
    banUser(socket, ip, reason) {
        this.bannedUsers.add(ip);
        socket.emit('banned', { reason });
        this.matchmaker.handleDisconnect(socket.id); // Remove from matchmaking
        socket.disconnect();
        console.log(`Banned user ${socket.id} (${ip}) for: ${reason}`);
    }
}
exports.SignalingServer = SignalingServer;
