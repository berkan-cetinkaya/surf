export class FormUseCase {
    validate(data) {
        const { name, email, password } = data;
        const errors = [];

        if (!name || name.trim().length < 2) {
            errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
        }

        if (!email || !email.includes('@')) {
            errors.push({ field: 'email', message: 'Please enter a valid email' });
        }

        if (!password || password.length < 8) {
            errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
