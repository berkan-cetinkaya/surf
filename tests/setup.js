import {} from 'vitest';

console.log('[Setup] Polyfilling requestSubmit');

// JSDOM polyfill for requestSubmit
if (typeof window !== 'undefined' && typeof HTMLFormElement !== 'undefined') {
  Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
    value: function (submitter) {
      if (submitter) {
        if (submitter.form !== this) {
          throw new DOMException(
            'The submitter is not associated with this form.',
            'NotFoundError'
          );
        }
      }

      // Manually dispatch the 'submit' event
      const event = new Event('submit', { bubbles: true, cancelable: true });

      // Attach submitter to the event if provided
      if (submitter) {
        Object.defineProperty(event, 'submitter', { value: submitter, enumerable: true });
      }

      const cancelled = !this.dispatchEvent(event);

      // If the event was not cancelled, proceed with form submission
      if (!cancelled) {
        this.submit();
      }
    },
    writable: true,
    configurable: true,
  });
}
