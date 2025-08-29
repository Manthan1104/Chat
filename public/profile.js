document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('chat-token');
    // From previous step: logic to get the correct username to view
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');
    const usernameToFetch = profileUsername || localStorage.getItem('chat-username');

    if (!token || !usernameToFetch) {
        window.location.href = '/login.html';
        return;
    }

    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // --- Theme Management ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            themeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            themeToggle.checked = false;
        }
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- Fetch User Data ---
    const fetchUserData = async () => {
        try {
            const response = await fetch(`/api/user/${usernameToFetch}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // --- NEW: Handle Expired/Invalid Token ---
            if (response.status === 401 || response.status === 403) {
                // Token is invalid, so clear session and redirect to login
                localStorage.clear();
                window.location.href = '/login.html';
                return; // Stop further execution
            }

            if (!response.ok) {
                // Handle other errors like user not found
                alert('Could not load profile. The user may not exist.');
                return;
            }
            
            const user = await response.json();
            const adminBadge = document.getElementById('admin-badge');

            document.getElementById('profile-name').textContent = user.name;
            document.getElementById('profile-email').textContent = user.email;

            if (user.role === 'admin') {
                adminBadge.classList.remove('hidden');
            } else {
                adminBadge.classList.add('hidden');
            }

            const profilePicture = document.getElementById('profile-picture');
            if (user.profilePicture) {
                profilePicture.src = user.profilePicture;
            } else {
                profilePicture.src = `https://placehold.co/100x100/6366f1/ffffff?text=${user.name.charAt(0).toUpperCase()}`;
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    fetchUserData();

    // --- Profile Picture Upload Logic (only if viewing own profile) ---
    const loggedInUsername = localStorage.getItem('chat-username');
    const pictureUploadContainer = document.querySelector('.avatar-container');
    
    if (usernameToFetch === loggedInUsername) {
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
    } else {
        // If not viewing your own profile, hide the edit button
        const editBtn = document.querySelector('.edit-btn');
        if (editBtn) editBtn.classList.add('hidden');
    }
});

