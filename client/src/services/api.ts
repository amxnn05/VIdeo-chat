const API_URL = 'http://localhost:3000/api'; // Adjust if needed

export const api = {
	joinQueue: async (name: string) => {
		const response = await fetch(`${API_URL}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		return response.json();
	},

	poll: async (userId: string) => {
		const response = await fetch(`${API_URL}/poll/${userId}`);
		if (!response.ok) return null;
		return response.json();
	},

	leaveQueue: async (userId: string) => {
		await fetch(`${API_URL}/leave`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId }),
		});
	},
};
