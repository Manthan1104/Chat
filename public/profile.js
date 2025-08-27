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
            const adminBadge = document.getElementById('admin-badge');
            
            document.getElementById('profile-name').textContent = user.name;
            document.getElementById('profile-email').textContent = user.email;

            // --- CORRECTED LOGIC ---
            // Explicitly show or hide the badge based on the user's role
            if (user.role === 'admin') {
                adminBadge.classList.remove('hidden');
            } else {
                adminBadge.classList.add('hidden');
            }

            if (user.profilePicture) {
                document.getElementById('profile-picture').src = user.profilePicture;
            } else {
                document.getElementById('profile-picture').src = `https://placehold.co/100x100/6366f1/ffffff?text=${user.name.charAt(0).toUpperCase()}`;
            }

            const dob = user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided';
            const joined = new Date(user.joined).toLocaleDateString();
            document.getElementById('profile-dob').textContent = dob;
            document.getElementById('profile-joined').textContent = joined;

        } else {
            alert('Could not load your profile.');
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }

    // ... (picture upload logic remains the same)
    const pictureUpload = document.getElementById('picture-upload');
    pictureUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            try {
                const response = await fetch('/api/user/picture', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ picture: base64String })
                });

                if (response.ok) {
                    document.getElementById('profile-picture').src = base64String;
                    alert('Profile picture updated!');
                } else {
                    alert('Failed to update profile picture.');
                }
            } catch (error) {
                console.error('Error uploading picture:', error);
            }
        };
        reader.readAsDataURL(file);
    });
});
