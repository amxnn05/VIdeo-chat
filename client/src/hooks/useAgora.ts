import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack, type IRemoteAudioTrack, type IRemoteVideoTrack, type UID } from 'agora-rtc-sdk-ng';
import { api } from '../services/api';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';

export const useAgora = () => {
	const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
	const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
	const [remoteUsers, setRemoteUsers] = useState<Array<{ uid: UID, videoTrack?: IRemoteVideoTrack, audioTrack?: IRemoteAudioTrack }>>([]);

	const [isSearching, setIsSearching] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [partnerName, setPartnerName] = useState<string>('Stranger');
	const [messages, setMessages] = useState<{ sender: 'me' | 'stranger'; text: string }[]>([]);

	const client = useRef<IAgoraRTCClient | null>(null);
	const userId = useRef<string | null>(null);
	const pollingInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Refs for tracks to ensure cleanup works in useEffect
	const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
	const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
	const isFetchingTracks = useRef(false);
	const isMounted = useRef(true);
	const streamId = useRef<number | null>(null);

	useEffect(() => {
		isMounted.current = true;
		if (!APP_ID) {
			console.error("Agora App ID is missing. Please set VITE_AGORA_APP_ID in .env");
		}

		client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

		client.current.on('user-published', async (user, mediaType) => {
			if (!isMounted.current) return;
			await client.current!.subscribe(user, mediaType);
			if (mediaType === 'video') {
				setRemoteUsers(prev => {
					const existing = prev.find(u => u.uid === user.uid);
					if (existing) return prev.map(u => u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u);
					return [...prev, { uid: user.uid, videoTrack: user.videoTrack }];
				});
			}
			if (mediaType === 'audio') {
				user.audioTrack?.play();
				setRemoteUsers(prev => {
					const existing = prev.find(u => u.uid === user.uid);
					if (existing) return prev.map(u => u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u);
					return [...prev, { uid: user.uid, audioTrack: user.audioTrack }];
				});
			}
		});

		client.current.on('user-unpublished', (user, mediaType) => {
			if (!isMounted.current) return;
			if (mediaType === 'video') {
				setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, videoTrack: undefined } : u));
			}
			if (mediaType === 'audio') {
				setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, audioTrack: undefined } : u));
			}
		});

		client.current.on('user-left', (user) => {
			if (!isMounted.current) return;
			setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
			handlePartnerDisconnect();
		});

		// Listen for stream messages (chat)
		client.current.on('stream-message', (uid, payload) => {
			console.log("Received stream-message from", uid, payload);
			if (!isMounted.current) return;
			try {
				const text = new TextDecoder().decode(payload);
				console.log("Decoded message:", text);
				setMessages(prev => {
					console.log("Updating messages state with new message");
					return [...prev, { sender: 'stranger', text }];
				});
			} catch (e) {
				console.error("Error decoding message:", e);
			}
		});

		return () => {
			isMounted.current = false;
			leave();
			localVideoTrackRef.current?.close();
			localAudioTrackRef.current?.close();
			localVideoTrackRef.current = null;
			localAudioTrackRef.current = null;
		};
	}, []);

	const startLocalStream = async () => {
		if (isFetchingTracks.current || localVideoTrackRef.current) return;

		try {
			isFetchingTracks.current = true;
			const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

			// Check if unmounted while fetching
			if (!isMounted.current) {
				audioTrack.close();
				videoTrack.close();
				return;
			}

			setLocalAudioTrack(audioTrack);
			setLocalVideoTrack(videoTrack);
			localAudioTrackRef.current = audioTrack;
			localVideoTrackRef.current = videoTrack;
			return { audioTrack, videoTrack };
		} catch (e) {
			console.error("Error creating tracks:", e);
		} finally {
			isFetchingTracks.current = false;
		}
	};

	const startSearch = async (userName: string) => {
		if (isConnected) await leave();

		setIsSearching(true);
		setMessages([]);
		setPartnerName('Stranger');

		const { userId: newUserId } = await api.joinQueue(userName);
		userId.current = newUserId;

		// Start polling
		pollingInterval.current = setInterval(async () => {
			if (!userId.current) return;
			const status = await api.poll(userId.current);

			if (status && status.status === 'matched') {
				if (pollingInterval.current) {
					clearInterval(pollingInterval.current);
					pollingInterval.current = null;
				}

				setIsSearching(false);
				setIsConnected(true);
				setPartnerName(status.partnerName || 'Stranger');

				await joinChannel(status.agoraChannel!, status.token || null);
			}
		}, 1000);
	};

	const joinChannel = async (channelName: string, token: string | null) => {
		if (!client.current || !localAudioTrack || !localVideoTrack) return;

		try {
			await client.current.join(APP_ID, channelName, token, null);
			await client.current.publish([localAudioTrack, localVideoTrack]);

			// Create data stream for chat
			try {
				if (!streamId.current) {
					// @ts-ignore
					streamId.current = await client.current.createDataStream();
					console.log("Data stream created:", streamId.current);
				}
			} catch (e) {
				console.error("Failed to create data stream:", e);
			}
		} catch (error: any) {
			console.error("Failed to join channel:", error);
			if (error.code === 'CAN_NOT_GET_GATEWAY_SERVER' || error.message?.includes('dynamic use static key')) {
				alert("Connection Failed: Your Agora Project has 'App Certificate' enabled, but the app is trying to join without a token.\n\nPlease create a new Agora Project with 'App ID only' authentication (Testing Mode) and update your .env file.");
			} else {
				alert(`Connection Failed: ${error.message || error}`);
			}
			await leave();
		}
	};

	const leave = async () => {
		if (pollingInterval.current) {
			clearInterval(pollingInterval.current);
			pollingInterval.current = null;
		}

		if (userId.current) {
			await api.leaveQueue(userId.current);
			userId.current = null;
		}

		if (client.current) {
			await client.current.leave();
			setRemoteUsers([]);
		}

		streamId.current = null;
		setIsConnected(false);
		setIsSearching(false);
	};

	const nextChat = async (userName: string) => {
		await leave();
		await startSearch(userName);
	};

	const sendChatMessage = async (text: string) => {
		if (!client.current) return;

		// Optimistic update
		setMessages(prev => [...prev, { sender: 'me', text }]);

		try {
			// Try to create stream if it doesn't exist
			if (!streamId.current) {
				try {
					// @ts-ignore
					streamId.current = await client.current.createDataStream();
					console.log("Data stream created on demand:", streamId.current);
				} catch (err) {
					console.error("Failed to create data stream on demand:", err);
					return;
				}
			}

			if (!streamId.current) return;

			const data = new TextEncoder().encode(text);
			// @ts-ignore
			await client.current.sendStreamMessage(streamId.current, data);
			console.log("Message sent successfully via stream", streamId.current);
		} catch (e) {
			console.error("Chat error:", e);
			// Optionally mark message as failed in UI, but for now just log it
		}
	};

	const handlePartnerDisconnect = () => {
		setIsConnected(false);
		setRemoteUsers([]);
		setMessages(prev => [...prev, { sender: 'stranger', text: 'Partner disconnected' }]);
	};

	const toggleAudio = (enabled: boolean) => {
		localAudioTrack?.setEnabled(enabled);
	};

	const toggleVideo = (enabled: boolean) => {
		localVideoTrack?.setEnabled(enabled);
	};

	return {
		localVideoTrack,
		localAudioTrack,
		remoteUsers,
		isSearching,
		isConnected,
		messages,
		partnerName,
		startLocalStream,
		startSearch,
		nextChat,
		sendMessage: sendChatMessage,
		toggleAudio,
		toggleVideo,
	};
};
