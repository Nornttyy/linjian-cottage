import { createRoot } from 'react-dom/client';
import Game from '../components/Game';
import '../app/globals.css';

declare const __GAME_API_URL__: string;
createRoot(document.getElementById('root')!).render(<Game apiUrl={__GAME_API_URL__} />);
