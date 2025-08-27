// public/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // --- Logic for Login Form ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = loginForm.name.value.trim();
            const password = loginForm.password.value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, password })
                });

                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('chat-token', result.token);
                    localStorage.setItem('chat-username', result.name);
                    localStorage.setItem('chat-user-role', result.role);
                    window.location.href = '/index.html';
                } else {
                    showInlineError(loginForm, result.error || 'Login failed.');
                }
            } catch (error) {
                console.error('Login error:', error);
                showInlineError(loginForm, 'An error occurred. Please try again.');
            }
        });
    }

    // --- Logic for Signup Form ---
    if (signupForm) {
        const monthSelect = document.getElementById('dob-month');
        const daySelect = document.getElementById('dob-day');
        const yearSelect = document.getElementById('dob-year');

        populateDateDropdowns();

        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');

        async function checkAvailability() {
            clearFeedback();
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            if (!name && !email) return;

            try {
                const response = await fetch('/api/check-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email })
                });
                const data = await response.json();

                if (data.exists) {
                    showFeedback(nameInput, 'This name or email is already taken.', 'red');
                } else {
                    if (name) showFeedback(nameInput, 'This name is available!', 'green');
                    if (email) showFeedback(emailInput, 'This email is available!', 'green');
                }
            } catch (error) {
                console.error('Availability check failed:', error);
            }
        }

        nameInput.addEventListener('blur', checkAvailability);
        emailInput.addEventListener('blur', checkAvailability);

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFeedback();

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = signupForm.password.value;
            const year = yearSelect.value;
            const month = monthSelect.value.padStart(2, '0');
            const day = daySelect.value.padStart(2, '0');
            const dob = `${year}-${month}-${day}`;

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, dob })
                });

                const result = await response.json();
                if (response.ok) {
                    alert('Signup successful! Please log in.');
                    window.location.href = '/login.html';
                } else {
                    showInlineError(signupForm, result.error || 'Signup failed.');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showInlineError(signupForm, 'An error occurred. Please try again.');
            }
        });

        function populateDateDropdowns() {
            const currentYear = new Date().getFullYear();
            for (let i = currentYear; i >= currentYear - 100; i--) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                yearSelect.appendChild(option);
            }
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            months.forEach((month, index) => {
                const option = document.createElement('option');
                option.value = index + 1;
                option.textContent = month;
                monthSelect.appendChild(option);
            });
            for (let i = 1; i <= 31; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                daySelect.appendChild(option);
            }
        }

        function clearFeedback() {
            document.querySelectorAll('.feedback').forEach(el => el.remove());
            const errorEl = document.querySelector('.form-error');
            if (errorEl) errorEl.remove();
        }

        function showFeedback(input, message, color) {
            const feedback = document.createElement('span');
            feedback.className = 'feedback';
            feedback.textContent = message;
            feedback.style.color = color;
            feedback.style.fontSize = '0.8rem';
            feedback.style.display = 'block';
            feedback.style.marginTop = '4px';
            input.after(feedback);
        }

        function showInlineError(form, message) {
            const error = document.createElement('div');
            error.className = 'form-error';
            error.style.color = 'red';
            error.style.marginTop = '10px';
            error.textContent = message;
            form.appendChild(error);
        }
    }
});

