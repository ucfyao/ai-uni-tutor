import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { showNotification } from './notifications';

// Mock mantine notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

describe('showNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show notification when called for the first time', () => {
    const data = { title: 'Test', message: 'First message', color: 'green' };
    showNotification(data);
    expect(notifications.show).toHaveBeenCalledWith(data);
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });

  it('should throttle identical notifications within 2 seconds', () => {
    const data = { title: 'Test', message: 'Repeated message', color: 'red' };

    // First call
    showNotification(data);
    expect(notifications.show).toHaveBeenCalledTimes(1);

    // Immediate second call
    showNotification(data);
    expect(notifications.show).toHaveBeenCalledTimes(1); // Should still be 1

    // Advance time by 1000ms (within throttle window)
    vi.advanceTimersByTime(1000);
    showNotification(data);
    expect(notifications.show).toHaveBeenCalledTimes(1); // Should still be 1

    // Advance time to 2001ms (just outside throttle window)
    vi.advanceTimersByTime(1001);
    showNotification(data);
    expect(notifications.show).toHaveBeenCalledTimes(2); // Should trigger now
  });

  it('should allow different notifications immediately', () => {
    const data1 = { title: 'Test 1', message: 'Message 1' };
    const data2 = { title: 'Test 2', message: 'Message 2' };

    showNotification(data1);
    expect(notifications.show).toHaveBeenCalledWith(data1);

    showNotification(data2);
    expect(notifications.show).toHaveBeenCalledWith(data2);
    expect(notifications.show).toHaveBeenCalledTimes(2);
  });
});
