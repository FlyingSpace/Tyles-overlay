// ==UserScript==
// @name         r/tyles Overlay for TylesAT V2
// @author       floungd & Space
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  user overlay for r/tyles canvas V2
// @match        https://tyles.place/*
// @match        https://tyles.place
// @grant        none
// ==/UserScript==
// feel free to use this!

(function() {
    'use strict';

    const url = "https://github.com/FlyingSpace/Tyles-overlay/blob/main/overlay-01.png?raw=true";
    const dotScale = 0.45;
    const padding = 100; // Puffer für flüssiges Schieben

    let originalImageData = null;
    let imgWidth = 0;
    let imgHeight = 0;
    let renderTimeout = null;
    let currentRenderID = 0;

    function getConfig() {
        const container = document.querySelector("#canvas-overlay");
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const zoomLevel = rect.width / imgWidth;

        // Balance zwischen Schärfe und Ruckeln:
        // Wir deckeln die Auflösung bei 16x. 32x ist oft der "Todesstoß" für den Grafikspeicher.
        let res = 4;
        if (zoomLevel > 20) res = 16;
        else if (zoomLevel > 8) res = 8;

        const startX = Math.max(0, Math.floor(-rect.left / zoomLevel) - padding);
        const startY = Math.max(0, Math.floor(-rect.top / zoomLevel) - padding);
        const endX = Math.min(imgWidth, Math.ceil((window.innerWidth - rect.left) / zoomLevel) + padding);
        const endY = Math.min(imgHeight, Math.ceil((window.innerHeight - rect.top) / zoomLevel) + padding);

        return { startX, startY, endX, endY, res };
    }

    async function render() {
        const config = getConfig();
        if (!config || !originalImageData) return;

        const myID = ++currentRenderID;
        const { startX, startY, endX, endY, res } = config;

        const canvas = document.createElement('canvas');
        canvas.width = imgWidth * res;
        canvas.height = imgHeight * res;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        for (let y = startY; y < endY; y++) {
            if (myID !== currentRenderID) return;
            for (let x = startX; x < endX; x++) {
                const idx = (y * imgWidth + x) * 4;
                if (originalImageData[idx + 3] > 0) {
                    ctx.fillStyle = `rgba(${originalImageData[idx]}, ${originalImageData[idx+1]}, ${originalImageData[idx+2]}, ${originalImageData[idx+3]/255})`;
                    const cX = (x * res) + (res / 2);
                    const cY = (y * res) + (res / 2);
                    const r = (dotScale * res) / 2;
                    ctx.beginPath();
                    ctx.arc(cX, cY, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            if (y % 40 === 0) await new Promise(requestAnimationFrame);
        }

        if (myID === currentRenderID) {
            updateDOM(canvas);
        }
    }

    function updateDOM(newCanvas) {
        const container = document.querySelector("#canvas-overlay") || document.body;
        newCanvas.id = "stable-overlay";
        Object.assign(newCanvas.style, {
            position: "absolute", inset: "0", width: "100%", height: "100%",
            zIndex: "2147483647", pointerEvents: "none", imageRendering: "auto"
        });

        const old = document.getElementById("stable-overlay");
        if (old) container.replaceChild(newCanvas, old);
        else container.appendChild(newCanvas);
    }

    function trigger() {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(render, 100);
    }

    GM_xmlhttpRequest({
        method: "GET", url: url, responseType: "blob",
        onload: (res) => {
            const img = new Image();
            img.onload = function() {
                imgWidth = img.width; imgHeight = img.height;
                const c = document.createElement('canvas');
                c.width = imgWidth; c.height = imgHeight;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                originalImageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;
                render();
                window.addEventListener('wheel', trigger, {passive: true});
                window.addEventListener('mouseup', trigger);
                window.addEventListener('resize', render);
            };
            img.src = URL.createObjectURL(res.response);
        }
    });
})();
