/**
 * Surf Debounce Plugin
 * 
 * Automatically triggers server requests from input fields after a delay.
 * Replaces manual event handling for search/filter inputs.
 * 
 * Usage:
 * <input d-input="/search" d-debounce="300" d-target="#results" name="q">
 */
export default {
    install(Surf) {
        const timers = new WeakMap();

        document.addEventListener('input', (event) => {
            const input = event.target;
            if (!input.hasAttribute('d-input')) return;

            const url = input.getAttribute('d-input');
            const delay = parseInt(input.getAttribute('d-debounce') || '300', 10);
            const target = input.getAttribute('d-target');
            const minLength = parseInt(input.getAttribute('d-min-length') || '3', 10);
            const value = input.value.trim();

            // Clear existing timer
            if (timers.has(input)) {
                clearTimeout(timers.get(input));
            }

            // Set new timer
            const timer = setTimeout(() => {
                // Check min length (unless empty, which might clear results)
                if (value.length > 0 && value.length < minLength) return;

                // Prepare URL with query param
                const separator = url.includes('?') ? '&' : '?';
                const name = input.name || 'q';
                const requestUrl = `${url}${separator}${name}=${encodeURIComponent(value)}`;

                // Use Surf.navigate logic (GET request replacing target)
                Surf.go(requestUrl, { target });

            }, delay);

            timers.set(input, timer);
        });

        console.log('[Surf] Debounce Plugin installed');
    }
};
