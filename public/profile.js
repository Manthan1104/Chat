// public/profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');

    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`/api/user/${username}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            document.getElementById('avatar-initial').textContent = user.name.charAt(0).toUpperCase();
            document.getElementById('profile-name').textContent = user.name;
            document.getElementById('profile-email').textContent = user.email;
            
            // Format dates for display
            const dob = user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided';
            const joined = new Date(user.joined).toLocaleDateString();

            document.getElementById('profile-dob').textContent = dob;
            document.getElementById('profile-joined').textContent = joined;

        } else {
            console.error('Failed to fetch user data');
            alert('Could not load your profile.');
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
});
