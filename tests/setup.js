/**
 * Vitest Setup File
 * 
 * Provides polyfills for JSDOM missing or incomplete features.
 */

// JSDOM doesn't implement requestSubmit(), but it exists on the prototype
// and throws "Not implemented". We override it with a working version.
if (typeof window !== 'undefined' && typeof HTMLFormElement !== 'undefined') {
  HTMLFormElement.prototype.requestSubmit = function(submitter) {
    if (submitter) {
      if (!(submitter instanceof HTMLElement)) throw new TypeError('The submitter is not an HTMLElement.');
      if (submitter.type !== 'submit') throw new TypeError('The submitter is not a submit button.');
      if (submitter.form !== this) throw new DOMException('The submitter is not associated with this form.', 'NotFoundError');
      submitter.click();
    } else {
      // Create a temporary submit button and click it to trigger validation/submit event
      const submitButton = document.createElement('input');
      submitButton.type = 'submit';
      submitButton.style.display = 'none';
      this.appendChild(submitButton);
      submitButton.click();
      this.removeChild(submitButton);
    }
  };
}
