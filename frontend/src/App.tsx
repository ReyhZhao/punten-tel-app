import React from 'react';
import { useAppState } from './store';
import { theme } from './theme';
import HomeScreen from './components/screens/HomeScreen';
import NewGameScreen from './components/screens/NewGameScreen';
import ScoringScreen from './components/screens/ScoringScreen';
import WinnerScreen from './components/screens/WinnerScreen';
import PlayersScreen from './components/screens/PlayersScreen';

export default function App() {
  const { st, actions } = useAppState();
  const { games, screen, currentId } = st;
  const current = games.find((g) => g.id === currentId);

  let content: React.ReactNode;
  if (screen === 'players') {
    content = <PlayersScreen theme={theme} actions={actions} savedPlayers={st.savedPlayers ?? []} />;
  } else if (screen === 'new') {
    content = <NewGameScreen theme={theme} actions={actions} savedPlayers={st.savedPlayers ?? []} />;
  } else if (screen === 'scoring' && current) {
    content = <ScoringScreen theme={theme} game={current} actions={actions} />;
  } else if (screen === 'winner' && current) {
    content = <WinnerScreen theme={theme} game={current} actions={actions} />;
  } else {
    content = <HomeScreen theme={theme} games={games} actions={actions} />;
  }

  return <>{content}</>;
}
