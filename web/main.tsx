import { createRoot } from 'react-dom/client';
import GameShell from '../components/GameShell';
import SiteEntry from '../components/SiteEntry';
import '../app/globals.css';

declare const __GAME_API_URL__: string;
createRoot(document.getElementById('root')!).render(<SiteEntry><GameShell apiUrl={__GAME_API_URL__} /></SiteEntry>);
