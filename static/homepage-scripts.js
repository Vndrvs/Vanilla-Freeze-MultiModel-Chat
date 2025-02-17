// I've created a nice matrix-ish bg animation with flowing digits
// in its current version, it can get heavy on resources, so I disabled it 
// plan to reimplement after optimizing

/*

document.addEventListener("DOMContentLoaded", function () {
    const matrixContainer = document.getElementById("matrix-background");
    const lineLength = 80;
    const maxLines = 40;

    function generateRandomLine() {
        const line = document.createElement("div");
        for (let i = 0; i < lineLength; i++) {
            const number = Math.floor(Math.random() * 10);
            const span = document.createElement("span");
            span.textContent = number;

            const randomClass = getRandomFlickerClass();
            span.classList.add(randomClass);

            line.appendChild(span);
        }
        return line;
    }

    function getRandomFlickerClass() {
        const classes = ['flicker-visible', 'flicker-translucent', 'flicker-high-opacity'];
        return classes[Math.floor(Math.random() * classes.length)];
    }

    function addLine() {
        const newLine = generateRandomLine();
        matrixContainer.appendChild(newLine);

        if (matrixContainer.children.length > maxLines) {
            matrixContainer.removeChild(matrixContainer.firstChild);
        }
    }

    function initializeMatrix() {
        for (let i = 0; i < maxLines; i++) {
            addLine();
        }
    }

    function adjustFontSize() {
        const viewportWidth = window.innerWidth;

        const fontSize = Math.min(2, 190 / lineLength) + "vw";
        matrixContainer.style.fontSize = fontSize;
    }

    adjustFontSize();
    window.addEventListener("resize", adjustFontSize);
    initializeMatrix();
    setInterval(addLine, 150);
});
*/

document.addEventListener('DOMContentLoaded', () => {
    const preloaderContainer = document.querySelector('.preloader-container');
    const mainWrapper = document.getElementById('main-wrapper');
    const matrixContainer = document.getElementById('matrix-container');

    mainWrapper.style.display = 'none';
    matrixContainer.style.display = 'none';

    setTimeout(() => {
        preloaderContainer.style.opacity = '0';
        preloaderContainer.style.transition = 'opacity 1s ease-in-out';

        setTimeout(() => {
            preloaderContainer.style.display = 'none';
            mainWrapper.style.display = 'flex';
            matrixContainer.style.display = 'block';
        }, 1000);
    }, 3000);
});
