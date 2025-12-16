import express from 'express';
import http from 'http';
import cors from 'cors';
import { Matchmaker } from './Matchmaker';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

const matchmaker = new Matchmaker();

app.get('/', (req, res) => {
	res.send('Server is running....');
});

app.post('/api/join', (req, res) => {
	const { name } = req.body;
	const result = matchmaker.joinQueue(name);
	res.json(result);
});

app.get('/api/poll/:userId', (req, res) => {
	const { userId } = req.params;
	const result = matchmaker.poll(userId);
	if (!result) {
		res.status(404).json({ error: 'User not found' });
		return;
	}
	res.json(result);
});

app.post('/api/leave', (req, res) => {
	const { userId } = req.body;
	matchmaker.leave(userId);
	res.json({ success: true });
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
