import { SeatInventory } from '../domain/seat.js';

// Singleton for demo purposes
const inventory = new SeatInventory(150);

export class SeatUseCase {
  getAvailability() {
    // Simulate random bookings by others
    if (Math.random() > 0.6 && inventory.available > 30) {
      const decrease = Math.floor(Math.random() * 3) + 1;
      inventory.available = Math.max(30, inventory.available - decrease);
    }

    return {
      count: inventory.available,
      price: 75,
      level: inventory.available < 50 ? 'low' : inventory.available < 100 ? 'medium' : 'high',
      updated: new Date().toLocaleTimeString(),
    };
  }

  book(count) {
    const success = inventory.book(count);
    return {
      success,
      bookedCount: count,
      totalPrice: count * 75,
      remaining: inventory.available,
    };
  }
}
