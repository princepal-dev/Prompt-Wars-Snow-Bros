import { InputState } from '../types';

export class InputManager {
  keys: Set<string> = new Set();
  
  private handleKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
  private handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  cleanup() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.keys.clear();
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