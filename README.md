# Ommegle

Ommegle is a video chat application that allows users to connect with strangers randomly. It features real-time video and audio communication using Agora and a chat interface.

## Project Structure

The project is divided into two main parts:

- **client**: A React application built with Vite, TailwindCSS, and Agora RTC SDK.
- **server**: A Node.js/Express server that handles signaling and other backend logic.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/amxnn05/VIdeo-chat.git
cd VIdeo-chat
```

### 2. Server Setup

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory (if required by the server logic, otherwise skip).

### 3. Client Setup

Navigate to the client directory and install dependencies:

```bash
cd ../client
npm install
```

Create a `.env` file in the `client` directory with your Agora App ID:

```env
VITE_AGORA_APP_ID=your_agora_app_id
```

## Running the Application

### Start the Server

In the `server` directory:

```bash
npm run dev
```

The server will start (defaulting to port 3000 or as configured).

### Start the Client

In the `client` directory:

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Built With

- **Frontend**: React, Vite, TailwindCSS, Agora RTC SDK
- **Backend**: Node.js, Express, Socket.io (if applicable)
