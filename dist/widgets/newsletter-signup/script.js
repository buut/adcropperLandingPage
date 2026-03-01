document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.signup-form');
    const message = document.getElementById('message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.querySelector('input').value;
        console.log(`Subscribing ${email}...`);
        
        form.classList.add('hidden');
        message.classList.remove('hidden');
        
        setTimeout(() => {
            form.classList.remove('hidden');
            message.classList.add('hidden');
            form.reset();
        }, 3000);
    });
});
