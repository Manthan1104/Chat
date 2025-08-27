// public/profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');

    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    const profilePicture = document.getElementById('profile-picture');
    const pictureUpload = document.getElementById('picture-upload');

    // Fetch user data on page load
    try {
        const response = await fetch(`/api/user/${username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            document.getElementById('profile-name').textContent = user.name;
            document.getElementById('profile-email').textContent = user.email;
            

            // Check the user's role and display the badge
            if (user.role === 'admin') {
                document.getElementById('admin-badge').classList.remove('hidden');
            }


            if (user.profilePicture) {
                profilePicture.src = user.profilePicture;
            } else {
                profilePicture.src = `https://placehold.co/100x100/6366f1/ffffff?text=${user.name.charAt(0).toUpperCase()}`;
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

    // Handle profile picture upload
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
                    profilePicture.src = base64String; // Update image on success
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
