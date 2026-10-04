import { GameHost } from './game/GameHost.js';
import { GameConfigService } from './game/services/GameConfigService.js';
import { SessionClient } from './game/services/SessionClient.js';
import { SoundService } from './game/services/SoundService.js';
import { parseUrlParams } from './game/services/urlParams.js';
import { applyTheme } from './ui/applyTheme.js';
import { CompletionOverlay } from './ui/CompletionOverlay.js';
import { mustGet } from './ui/dom.js';
import { HeaderBar } from './ui/HeaderBar.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { StatsBar } from './ui/StatsBar.js';
import { TherapistPanel } from './ui/TherapistPanel.js';
import { Toaster } from './ui/Toaster.js';

async function bootstrap(): Promise<void> {
  const params = parseUrlParams();
  const loading = new LoadingScreen(mustGet('overlay-root'));
  const toaster = new Toaster(mustGet('toast-root'));
  const sound = new SoundService();
  const configService = new GameConfigService();
  const session = new SessionClient(params);

  const header = new HeaderBar(mustGet('header'), {
    role: params.role,
    sessionId: params.sessionId,
    muted: sound.muted,
    onToggleMute: () => sound.toggleMuted(),
  });
  const stats = new StatsBar(mustGet('stats'), () => session.serverNow());
  const overlay = new CompletionOverlay(mustGet('overlay-root'), () => session.send({ type: 'RESET_GAME' }));
  const host = new GameHost(mustGet('game-root'), sound, (action) => session.send(action));

  // Content comes from the API first (the same endpoint the customer's backend will expose),
  // then the session snapshot carries the authoritative config everyone in the room shares.
  try {
    const config = await configService.fetchGame(params.gameId);
    applyTheme(config.theme);
    header.setGameName(config.title);
  } catch (err) {
    loading.fail((err as Error).message);
    return;
  }

  let therapistPanel: TherapistPanel | null = null;
  if (params.role === 'therapist') {
    therapistPanel = new TherapistPanel(mustGet('therapist-panel'), (action) => session.send(action));
    configService
      .listGames()
      .then((games) => therapistPanel?.setGames(games, params.gameId))
      .catch(() => toaster.show('Could not load the game list', 'warn'));
  }

  let currentConfigKey: string | null = null;
  session.onSnapshot.on((snapshot) => {
    loading.hide();
    const configKey = JSON.stringify(snapshot.config);
    if (configKey !== currentConfigKey) {
      currentConfigKey = configKey;
      applyTheme(snapshot.config.theme);
      header.setGameName(snapshot.config.title);
      therapistPanel?.setCurrentGame(snapshot.gameId);
    }
    header.setParticipants(snapshot.participants);
    stats.update(snapshot.state);
    host.applySnapshot(snapshot);
    if (snapshot.state.status === 'completed') {
      setTimeout(() => {
        if (session.snapshot?.state.status === 'completed') overlay.show(snapshot.state, snapshot.config.theme.name);
      }, 900);
    } else {
      overlay.hide();
    }
    therapistPanel?.setStatusText(
      `Round ${snapshot.state.round} · ${snapshot.state.status} · ${snapshot.participants.student} student(s) connected`,
    );
  });
  session.onEvent.on((event) => host.handleEvent(event));
  session.onRejected.on(({ action, reason }) => {
    // Flip rejections are routine (two players, one board); everything else deserves a message.
    if (action !== 'FLIP_CARD') toaster.show(reason, 'warn');
  });
  session.onJoinError.on((message) => loading.fail(`Could not join the session: ${message}`));
  session.onStatus.on((status) => {
    header.setStatus(status);
    if (status === 'reconnecting') toaster.show('Connection lost, reconnecting...', 'warn', 1500);
  });

  loading.setMessage('Joining session...');
  session.connect();
  if (import.meta.env.DEV) (window as unknown as { __session: SessionClient }).__session = session;
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'error-text';
  p.style.padding = '20px';
  p.textContent = err instanceof Error ? err.message : String(err);
  document.body.append(p);
});
