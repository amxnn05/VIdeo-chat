import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './Login.css';

interface LoginProps {
	onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
	return (
		<div className="login-container">
			<h1 className="login-title">Welcome to Ommegle Clone</h1>
			<p className="login-subtitle">Sign in to start chatting with strangers!</p>

			<div className="login-box">
				<GoogleLogin
					onSuccess={(credentialResponse) => {
						if (credentialResponse.credential) {
							const decoded = jwtDecode(credentialResponse.credential);
							onLoginSuccess(decoded);
						}
					}}
					onError={() => {
						console.log('Login Failed');
					}}
				/>

				<div className="separator">
					<span>OR</span>
				</div>

				<button
					className="guest-btn"
					onClick={() => onLoginSuccess({ name: 'Guest ' + Math.floor(Math.random() * 1000) })}
				>
					Continue as Guest
				</button>
			</div>
		</div>
	);
};
