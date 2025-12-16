"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const Matchmaker_1 = require("./Matchmaker");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const matchmaker = new Matchmaker_1.Matchmaker();
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
