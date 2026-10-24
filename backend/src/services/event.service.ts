import type { InventoryEvent } from '../domain/inventory-event.js';
import type { EventRepository } from '../repositories/event.repository.js';

export class EventService {
  constructor(private readonly events: EventRepository) {}

  async listRecent(limit: number): Promise<{ data: InventoryEvent[] }> {
    return { data: await this.events.findRecent(limit) };
  }
}
