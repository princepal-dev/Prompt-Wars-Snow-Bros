
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
        // Placeholder for real URL
        // this.connect('ws://localhost:3000');
    }

    connect(url: string) {
        if (this.socket) return;
        
        try {
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                this.isConnected = true;
                console.log("Connected to Multiplayer Server");
            };

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.t === 'UP') {
                    if (this.onStateUpdate) this.onStateUpdate(msg);
                } else if (msg.t === 'ID') {
                    this.playerId = msg.id;
                }
            };
            
            this.socket.onclose = () => {
                this.isConnected = false;
            };
        } catch (e) {
            console.warn("Multiplayer server not available, running in offline mode.");
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
