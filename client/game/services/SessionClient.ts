import { io, type Socket } from 'socket.io-client';
import type {
  ActionRejected,
  ClientAction,
  ClientToServerEvents,
  GameEvent,
  ServerToClientEvents,
  SessionSnapshot,
} from '../../../shared/types/protocol.js';
import type { ConnectionStatus, UrlParams } from '../types/index.js';

type Listener<T> = (value: T) => void;

class Emitter<T> {
  private listeners = new Set<Listener<T>>();
  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(value: T): void {
    for (const fn of this.listeners) fn(value);
  }
}

/**
 * Template-agnostic synchronisation layer. Joins a session room, re-joins
 * (and therefore re-syncs the authoritative snapshot) after every reconnect,
 * drops out-of-order snapshots, and keeps a server clock offset for timers.
 */
export class SessionClient {
  readonly onSnapshot = new Emitter<SessionSnapshot>();
  readonly onEvent = new Emitter<GameEvent>();
  readonly onRejected = new Emitter<ActionRejected>();
  readonly onStatus = new Emitter<ConnectionStatus>();
  /** The server refused the join (bad session/game id, unknown game...). */
  readonly onJoinError = new Emitter<string>();

  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lastVersion = -1;
  private serverOffsetMs = 0;
  private _status: ConnectionStatus = 'connecting';
  private _snapshot: SessionSnapshot | null = null;

  constructor(private readonly params: UrlParams) {
    this.socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
    this.socket.on('connect', () => this.join());
    this.socket.on('disconnect', () => this.setStatus('disconnected'));
    this.socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    this.socket.io.on('reconnect_failed', () => this.setStatus('disconnected'));
    this.socket.on('session:state', (snapshot) => this.acceptSnapshot(snapshot));
    this.socket.on('session:event', (event) => this.onEvent.emit(event));
    this.socket.on('session:rejected', (info) => this.onRejected.emit(info));
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get snapshot(): SessionSnapshot | null {
    return this._snapshot;
  }

  connect(): void {
    this.setStatus('connecting');
    this.socket.connect();
  }

  send(action: ClientAction): void {
    if (!this.socket.connected) return;
    this.socket.emit('session:action', action);
  }

  /** Dev/testing aid: drop the transport so the automatic reconnect + resync path runs. */
  simulateConnectionLoss(): void {
    this.socket.io.engine.close();
  }

  /** Current time on the server's clock, for timers that must agree across clients. */
  serverNow(): number {
    return Date.now() + this.serverOffsetMs;
  }

  private join(): void {
    this.lastVersion = -1; // A reconnect may land on a fresh server; accept whatever it has.
    this.socket.emit(
      'session:join',
      { sessionId: this.params.sessionId, role: this.params.role, gameId: this.params.gameId },
      (ack) => {
        if (!ack.ok) {
          console.error('[session] join rejected:', ack.error);
          this.onJoinError.emit(ack.error);
          return;
        }
        this.acceptSnapshot(ack.snapshot);
        this.setStatus('connected');
      },
    );
  }

  private acceptSnapshot(snapshot: SessionSnapshot): void {
    if (snapshot.version <= this.lastVersion) return;
    this.lastVersion = snapshot.version;
    this.serverOffsetMs = snapshot.serverTime - Date.now();
    this._snapshot = snapshot;
    this.onSnapshot.emit(snapshot);
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this._status) return;
    this._status = status;
    this.onStatus.emit(status);
  }
}
