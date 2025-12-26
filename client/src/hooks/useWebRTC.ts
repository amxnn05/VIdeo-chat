import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000'; // Adjust if deployed

const STUN_SERVERS = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
	],
};

export const useWebRTC = () => {
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const [isSearching, setIsSearching] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [partnerName, setPartnerName] = useState<string>('Stranger');
	const [messages, setMessages] = useState<{ sender: 'me' | 'stranger'; text: string }[]>([]);

	const socket = useRef<Socket | null>(null);
	const peerConnection = useRef<RTCPeerConnection | null>(null);
	const isInitiator = useRef(false);
	const localStreamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		socket.current = io(SERVER_URL);

		socket.current.on('connect', () => {
			console.log("Connected to WebSocket server");
		});

		socket.current.on('match_found', async (data: { partnerName: string, isInitiator: boolean }) => {
			console.log("Match found!", data);
			setIsSearching(false);
			setIsConnected(true);
			setPartnerName(data.partnerName || 'Stranger');
			isInitiator.current = data.isInitiator;

			createPeerConnection();

			if (data.isInitiator) {
				await createOffer();
			}
		});

		socket.current.on('signal', async (data: { type: string, payload: any }) => {
			if (!peerConnection.current) return;

			if (data.type === 'offer') {
				await handleOffer(data.payload);
			} else if (data.type === 'answer') {
				await handleAnswer(data.payload);
			} else if (data.type === 'candidate') {
				await handleCandidate(data.payload);
			}
		});

		socket.current.on('chat_message', (data: { text: string, sender: string }) => {
			console.log("Received chat message:", data);
			setMessages(prev => [...prev, { sender: 'stranger', text: data.text }]);
		});

		socket.current.on('partner_disconnected', () => {
			console.log("Partner disconnected");
			handlePartnerDisconnect();
		});

		return () => {
			leave();
			socket.current?.disconnect();
		};
	}, []);

	const createPeerConnection = () => {
		if (peerConnection.current) return;

		const pc = new RTCPeerConnection(STUN_SERVERS);
		peerConnection.current = pc;

		pc.onicecandidate = (event) => {
			if (event.candidate) {
				socket.current?.emit('signal', {
					type: 'candidate',
					payload: event.candidate
				});
			}
		};

		pc.ontrack = (event) => {
			console.log("Received remote track");
			setRemoteStream(event.streams[0]);
		};

		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(track => {
				pc.addTrack(track, localStreamRef.current!);
			});
		}
	};

	const createOffer = async () => {
		if (!peerConnection.current) return;
		try {
			const offer = await peerConnection.current.createOffer();
			await peerConnection.current.setLocalDescription(offer);
			socket.current?.emit('signal', { type: 'offer', payload: offer });
		} catch (e) {
			console.error("Error creating offer:", e);
		}
	};

	const handleOffer = async (offer: RTCSessionDescriptionInit) => {
		if (!peerConnection.current) return;
		try {
			await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
			const answer = await peerConnection.current.createAnswer();
			await peerConnection.current.setLocalDescription(answer);
			socket.current?.emit('signal', { type: 'answer', payload: answer });
		} catch (e) {
			console.error("Error handling offer:", e);
		}
	};

	const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
		if (!peerConnection.current) return;
		try {
			await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
		} catch (e) {
			console.error("Error handling answer:", e);
		}
	};

	const handleCandidate = async (candidate: RTCIceCandidateInit) => {
		if (!peerConnection.current) return;
		try {
			await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (e) {
			console.error("Error handling candidate:", e);
		}
	};

	const startLocalStream = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			setLocalStream(stream);
			localStreamRef.current = stream;
			return stream;
		} catch (e) {
			console.error("Error accessing media devices:", e);
		}
	};

	const startSearch = (userName: string) => {
		if (isConnected) leave();

		setIsSearching(true);
		setMessages([]);
		setPartnerName('Stranger');
		setRemoteStream(null);

		socket.current?.emit('join_queue', { name: userName });
	};

	const leave = () => {
		socket.current?.emit('leave_queue');

		if (peerConnection.current) {
			peerConnection.current.close();
			peerConnection.current = null;
		}

		setRemoteStream(null);
		setIsConnected(false);
		setIsSearching(false);
	};

	const nextChat = (userName: string) => {
		leave();
		startSearch(userName);
	};

	const sendMessage = (text: string) => {
		setMessages(prev => [...prev, { sender: 'me', text }]);
		socket.current?.emit('chat_message', { text });
	};

	const handlePartnerDisconnect = () => {
		if (peerConnection.current) {
			peerConnection.current.close();
			peerConnection.current = null;
		}
		setRemoteStream(null);
		setIsConnected(false);
		setMessages(prev => [...prev, { sender: 'stranger', text: 'Partner disconnected' }]);
	};

	const toggleAudio = (enabled: boolean) => {
		if (localStreamRef.current) {
			localStreamRef.current.getAudioTracks().forEach(track => track.enabled = enabled);
		}
	};

	const toggleVideo = (enabled: boolean) => {
		if (localStreamRef.current) {
			localStreamRef.current.getVideoTracks().forEach(track => track.enabled = enabled);
		}
	};

	return {
		localStream,
		remoteStream,
		isSearching,
		isConnected,
		messages,
		partnerName,
		startLocalStream,
		startSearch,
		nextChat,
		sendMessage,
		toggleAudio,
		toggleVideo,
	};
};
