import React, { useEffect, useRef, useState } from 'react';
import * as nsfwjs from 'nsfwjs';
import { useWebRTC } from '../hooks/useWebRTC';
import './VideoCall.css';

interface VideoCallProps {
	user: any;
}

export const VideoCall: React.FC<VideoCallProps> = ({ user }) => {
	const {
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
	} = useWebRTC();

	const [input, setInput] = useState('');
	const [isAudioEnabled, setIsAudioEnabled] = useState(true);
	const [isVideoEnabled, setIsVideoEnabled] = useState(true);
	const [model, setModel] = useState<nsfwjs.NSFWJS | null>(null);
	const [isModelLoaded, setIsModelLoaded] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

	useEffect(() => {
		if (localVideoRef.current && localStream) {
			localVideoRef.current.srcObject = localStream;
		}
	}, [localStream]);

	useEffect(() => {
		if (remoteVideoRef.current && remoteStream) {
			remoteVideoRef.current.srcObject = remoteStream;
		}
	}, [remoteStream]);

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

	// Play Local Video Logic and Analysis
	useEffect(() => {
		if (localStream) {
			// Setup for NSFW analysis ONLY if model is loaded
			if (isModelLoaded && analysisVideoRef.current) {
				try {
					analysisVideoRef.current.srcObject = localStream;
				} catch (e) {
					console.warn("Failed to create analysis stream:", e);
				}
			}
		}
	}, [localStream, isModelLoaded]);

	// Content Moderation Loop
	useEffect(() => {
		if (isModelLoaded && model && analysisVideoRef.current && localStream) {
			checkInterval.current = setInterval(async () => {
				if (analysisVideoRef.current && analysisVideoRef.current.readyState === 4) {
					try {
						const predictions = await model.classify(analysisVideoRef.current);
						const porn = predictions.find(p => p.className === 'Porn');
						const hentai = predictions.find(p => p.className === 'Hentai');

						if ((porn && porn.probability > 0.6) || (hentai && hentai.probability > 0.6)) {
							console.warn('NSFW Content Detected!', predictions);
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
	}, [model, localStream, isModelLoaded]);

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
						{ /* Changed to video element */}
						<video ref={localVideoRef} autoPlay muted className="video-container" />
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
						{remoteStream ? (
							<video ref={remoteVideoRef} autoPlay className="video-container" />
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

