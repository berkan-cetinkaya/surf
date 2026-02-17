export class SeatInventory {
  constructor(initialCount = 10) {
    this.available = initialCount;
  }

  book(count) {
    if (count > this.available) {
      return false;
    }
    this.available -= count;
    return true;
  }
}
