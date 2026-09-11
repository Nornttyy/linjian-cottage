import { createRoot } from 'react-dom/client';
import GameShell from '../components/GameShell';
import '../app/globals.css';

declare const __GAME_API_URL__: string;
createRoot(document.getElementById('root')!).render(<GameShell apiUrl={__GAME_API_URL__} />);
