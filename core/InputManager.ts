import { InputState } from '../types';

export class InputManager {
  keys: Set<string> = new Set();
  
  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  getState(): InputState {
    return {
      left: this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
      right: this.keys.has('ArrowRight') || this.keys.has('KeyD'),
      up: this.keys.has('ArrowUp') || this.keys.has('KeyW'),
      down: this.keys.has('ArrowDown') || this.keys.has('KeyS'),
      jump: this.keys.has('Space') || this.keys.has('KeyZ'),
      shoot: this.keys.has('KeyL'),
    };
  }
}