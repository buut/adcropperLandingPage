function updateTimer() {
    // Set target date (e.g., end of the year)
    const targetDate = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59).getTime();
    
    function tick() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById("days").innerText = days.toString().padStart(2, '0');
        document.getElementById("hours").innerText = hours.toString().padStart(2, '0');
        document.getElementById("minutes").innerText = minutes.toString().padStart(2, '0');
        document.getElementById("seconds").innerText = seconds.toString().padStart(2, '0');

        if (distance < 0) {
            clearInterval(timerInterval);
            document.querySelector(".timer-container").innerHTML = "<h1>EXPIRED</h1>";
        }
    }

    tick();
    const timerInterval = setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', updateTimer);
