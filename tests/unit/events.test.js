import { describe, it, expect, vi } from 'vitest';
import Events from '../../src/events.js';

describe('Events Module', () => {
  it('should register and emit events', () => {
    const cb = vi.fn();
    Events.on('test-event', cb);

    Events.emit('test-event', { data: 123 });

    expect(cb).toHaveBeenCalledWith({ data: 123 });
    Events.off('test-event', cb);
  });

  it('should handle multiple listeners', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    Events.on('multi', cb1);
    Events.on('multi', cb2);

    Events.emit('multi', 'hello');

    expect(cb1).toHaveBeenCalledWith('hello');
    expect(cb2).toHaveBeenCalledWith('hello');

    Events.off('multi', cb1);
    Events.off('multi', cb2);
  });

  it('should stop emitting after off()', () => {
    const cb = vi.fn();
    Events.on('stop', cb);
    Events.off('stop', cb);

    Events.emit('stop', 'no');

    expect(cb).not.toHaveBeenCalled();
  });

  it('should handle errors in listeners gracefully', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = () => {
      throw new Error('Boom');
    };
    const healthy = vi.fn();

    Events.on('error-test', broken);
    Events.on('error-test', healthy);

    Events.emit('error-test', 'data');

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error in lifecycle listener'),
      expect.any(Error)
    );
    expect(healthy).toHaveBeenCalledWith('data');

    Events.off('error-test', broken);
    Events.off('error-test', healthy);
    spy.mockRestore();
  });
});
