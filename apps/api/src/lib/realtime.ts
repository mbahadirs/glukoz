import { EventEmitter } from 'node:events';
import type { StreamEvent } from '@glukoz/shared';

/** Süreç içi olay yolu: collector/alert motoru → SSE. */
export class RealtimeBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  publish(event: StreamEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(listener: (event: StreamEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
