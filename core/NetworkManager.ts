
import { InputState } from "../types";

// Mock implementation for Hackathon/Client-only demo
// In a real scenario, this connects to a Node.js WS server
export class NetworkManager {
    socket: WebSocket | null = null;
    isConnected: boolean = false;
    playerId: string | null = null;
    roomId: string | null = null;
    
    // State Buffer for Interpolation
    serverUpdates: any[] = [];
    
    onStateUpdate: ((state: any) => void) | null = null;

    constructor() {
        // No auto-connect in constructor
    }

    /**
     * Connects to the WebSocket server.
     * If no URL is provided, it determines the URL based on the current environment.
     */
    connect(url?: string) {
        if (this.socket) return;
        
        let connectionUrl = url;

        if (!connectionUrl) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            
            // If running on localhost, assume backend is on port 3000
            // If running in production (Cloud Run), use the same host/port (80/443)
            if (host === 'localhost' || host === '127.0.0.1') {
                connectionUrl = 'ws://localhost:3000';
            } else {
                // On Cloud Run, the WS server usually runs on the same domain
                connectionUrl = `${protocol}//${window.location.host}`;
            }
        }

        console.log(`[Net] Connecting to: ${connectionUrl}`);

        try {
            this.socket = new WebSocket(connectionUrl);
            
            this.socket.onopen = () => {
                this.isConnected = true;
                console.log("[Net] Connected to Multiplayer Server");
            };

            this.socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.t === 'UP') {
                        if (this.onStateUpdate) this.onStateUpdate(msg);
                    } else if (msg.t === 'ID') {
                        this.playerId = msg.id;
                    }
                } catch (err) {
                    console.error("[Net] Failed to parse message", err);
                }
            };
            
            this.socket.onclose = (event) => {
                this.isConnected = false;
                console.log(`[Net] Disconnected: Code ${event.code}`);
            };

            this.socket.onerror = (error) => {
                console.warn("[Net] WebSocket Error - Falling back to offline mode", error);
            };

        } catch (e) {
            console.warn("[Net] Multiplayer server not available, running in offline mode.");
        }
    }

    joinRoom(roomId: string) {
        if (!this.socket || !this.isConnected) return;
        this.roomId = roomId;
        this.socket.send(JSON.stringify({
            t: 'JOIN',
            room: roomId
        }));
    }

    sendInput(input: InputState) {
        if (!this.socket || !this.isConnected) return;
        
        // Compact input to save bandwidth
        const compact = {
            l: input.left ? 1 : 0,
            r: input.right ? 1 : 0,
            u: input.up ? 1 : 0,
            d: input.down ? 1 : 0,
            j: input.jump ? 1 : 0,
            s: input.shoot ? 1 : 0
        };

        this.socket.send(JSON.stringify({
            t: 'IN',
            ts: Date.now(),
            k: compact
        }));
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }
}
