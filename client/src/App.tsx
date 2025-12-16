import { useState } from 'react';
import { VideoCall } from './components/VideoCall';
import { Login } from './components/Login';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);

  return (
    <div className="App">
      {user ? (
        <VideoCall user={user} />
      ) : (
        <Login onLoginSuccess={setUser} />
      )}
    </div>
  );
}

export default App;
