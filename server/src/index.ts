import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Matchmaker } from './Matchmaker';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
	cors: {
		origin: '*', // Allow all origins for dev
		methods: ['GET', 'POST']
	}
});

const matchmaker = new Matchmaker(io);

io.on('connection', (socket) => {
	matchmaker.handleConnection(socket);
});

app.get('/', (req, res) => {
	res.send('Server is running....');
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

