import React, { useEffect, useRef, useState } from 'react';
import * as nsfwjs from 'nsfwjs';
import { useAgora } from '../hooks/useAgora';
import './VideoCall.css';

interface VideoCallProps {
	user: any;
}

export const VideoCall: React.FC<VideoCallProps> = ({ user }) => {
	const {
		localVideoTrack,
		remoteUsers,
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
	} = useAgora();

	const [input, setInput] = useState('');
	const [isAudioEnabled, setIsAudioEnabled] = useState(true);
	const [isVideoEnabled, setIsVideoEnabled] = useState(true);
	const [model, setModel] = useState<nsfwjs.NSFWJS | null>(null);
	const [isModelLoaded, setIsModelLoaded] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const localVideoRef = useRef<HTMLDivElement>(null);
	const remoteVideoRef = useRef<HTMLDivElement>(null);

	// Hidden video element for NSFWJS analysis
	const analysisVideoRef = useRef<HTMLVideoElement>(null);
	const checkInterval = useRef<any>(null);

	useEffect(() => {
		startLocalStream();
		loadModel();

		return () => {
			if (checkInterval.current) clearInterval(checkInterval.current);
		};
	}, []);

	const loadModel = async () => {
		try {
			const loadedModel = await nsfwjs.load();
			setModel(loadedModel);
			setIsModelLoaded(true);
			console.log('NSFWJS Model loaded');
		} catch (err) {
			console.error('Error loading NSFWJS model (NSFW filtering disabled):', err);
			setIsModelLoaded(false);
		}
	};

	// Play Local Video
	useEffect(() => {
		if (localVideoTrack && localVideoRef.current) {
			localVideoTrack.play(localVideoRef.current);

			// Setup for NSFW analysis ONLY if model is loaded
			if (isModelLoaded && analysisVideoRef.current) {
				try {
					const stream = new MediaStream([localVideoTrack.getMediaStreamTrack()]);
					analysisVideoRef.current.srcObject = stream;
				} catch (e) {
					console.warn("Failed to create analysis stream:", e);
				}
			}
		}
		return () => {
			localVideoTrack?.stop();
		};
	}, [localVideoTrack, isModelLoaded]);

	// Play Remote Video
	useEffect(() => {
		if (remoteUsers.length > 0 && remoteUsers[0].videoTrack && remoteVideoRef.current) {
			remoteUsers[0].videoTrack.play(remoteVideoRef.current);
		}
		if (remoteUsers.length > 0 && remoteUsers[0].audioTrack) {
			remoteUsers[0].audioTrack.play();
		}
	}, [remoteUsers]);

	// Content Moderation Loop
	useEffect(() => {
		if (isModelLoaded && model && analysisVideoRef.current && localVideoTrack) {
			checkInterval.current = setInterval(async () => {
				if (analysisVideoRef.current && analysisVideoRef.current.readyState === 4) {
					try {
						const predictions = await model.classify(analysisVideoRef.current);
						const porn = predictions.find(p => p.className === 'Porn');
						const hentai = predictions.find(p => p.className === 'Hentai');

						if ((porn && porn.probability > 0.6) || (hentai && hentai.probability > 0.6)) {
							console.warn('NSFW Content Detected!', predictions);
							// In Agora version, we might want to just stop the stream or alert
							// Since we removed socket.io 'ban_me', we can't easily self-ban on server without an API endpoint
							// For now, just stop local video
							toggleVideo(false);
							setIsVideoEnabled(false);
							alert("NSFW content detected. Your video has been disabled.");
						}
					} catch (err) {
						console.error('Error checking content:', err);
					}
				}
			}, 5000);
		}

		return () => {
			if (checkInterval.current) clearInterval(checkInterval.current);
		};
	}, [model, localVideoTrack, isModelLoaded]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const handleSend = () => {
		if (input.trim()) {
			sendMessage(input);
			setInput('');
		}
	};

	const handleAudioToggle = () => {
		const newState = !isAudioEnabled;
		setIsAudioEnabled(newState);
		toggleAudio(newState);
	};

	const handleVideoToggle = () => {
		const newState = !isVideoEnabled;
		setIsVideoEnabled(newState);
		toggleVideo(newState);
	};

	return (
		<div className="video-call-container">
			<div className="main-content">
				<div className="video-grid">
					<div className="video-wrapper local">
						<div ref={localVideoRef} className="video-container" />
						{/* Hidden video for analysis */}
						<video ref={analysisVideoRef} autoPlay muted style={{ display: 'none' }} />

						<span className="video-label">You ({user.name})</span>
						<div className="controls-overlay">
							<button
								onClick={handleAudioToggle}
								className={`control-btn ${!isAudioEnabled ? 'off' : ''}`}
								title={isAudioEnabled ? "Mute" : "Unmute"}
							>
								{isAudioEnabled ? "🎤" : "🔇"}
							</button>
							<button
								onClick={handleVideoToggle}
								className={`control-btn ${!isVideoEnabled ? 'off' : ''}`}
								title={isVideoEnabled ? "Stop Video" : "Start Video"}
							>
								{isVideoEnabled ? "📹" : "🚫"}
							</button>
						</div>
					</div>
					<div className="video-wrapper remote">
						{remoteUsers.length > 0 && remoteUsers[0].videoTrack ? (
							<div ref={remoteVideoRef} className="video-container" />
						) : (
							<div className="placeholder">
								{isSearching ? 'Looking for someone...' : 'Click Start to find a partner'}
							</div>
						)}
						<span className="video-label">{isConnected ? partnerName : 'Stranger'}</span>
					</div>
				</div>

				<div className="action-buttons">
					{!isConnected && !isSearching && (
						<button className="btn-primary" onClick={() => startSearch(user.name)}>
							Start Chat
						</button>
					)}
					{isSearching && (
						<button className="btn-secondary" disabled>
							Searching...
						</button>
					)}
					{isConnected && (
						<button className="btn-danger" onClick={() => nextChat(user.name)}>
							Next Person
						</button>
					)}
				</div>
			</div>

			<div className="chat-section">
				<div className="chat-header">
					<h3>Chat with {isConnected ? partnerName : 'Stranger'}</h3>
				</div>
				<div className="messages-list">
					{messages.map((msg, i) => (
						<div key={i} className={`message ${msg.sender}`}>
							<span className="sender-name">
								{msg.sender === 'me' ? 'You' : partnerName}:
							</span>
							<span className="message-text">{msg.text}</span>
						</div>
					))}
					<div ref={messagesEndRef} />
				</div>
				<div className="input-area">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && handleSend()}
						placeholder={isConnected ? "Type a message..." : "Connect to chat..."}
						disabled={!isConnected}
					/>
					<button onClick={handleSend} disabled={!isConnected || !input.trim()}>
						Send
					</button>
				</div>
			</div>
		</div>
	);
};
