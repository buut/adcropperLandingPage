document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.social-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = btn.id.split('-')[0];
            console.log(`Sharing on ${platform}...`);
            alert(`Sharing on ${platform}! (Demo)`);
        });
    });
});
