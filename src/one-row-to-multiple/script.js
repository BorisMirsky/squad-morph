const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const DOT_RADIUS = 6;
const ANIM_DURATION = 1200;

// Максимальная ширина строя — чтобы на широких экранах точки не разлетались
const MAX_FORMATION_WIDTH = 1400;

let WIDTH = 0;
let HEIGHT = 0;
let MARGIN_X = 0;
let MARGIN_Y = 0;
let ROW_GAP_Y = 0;
//const FRONT_STAGGER = 0.5;

let startPositions = [];
let targetPositions = [];
let currentPositions = [];
let animStart = 0;
let animating = false;

function easeInOut(t) {
    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function layout() {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    MARGIN_X = Math.max(40, WIDTH * 0.05);
    MARGIN_Y = Math.max(40, HEIGHT * 0.08);
    ROW_GAP_Y = Math.max(30, HEIGHT * 0.08);
}

// Полезная ширина строя — ограничена MAX_FORMATION_WIDTH и центрируется
function getUsableWidth() {
    const raw = WIDTH - 2 * MARGIN_X;
    return Math.min(raw, MAX_FORMATION_WIDTH);
}

// Левый край строя (чтобы строй был по центру экрана при ограничении)
function getFormationLeft(width) {
    return (WIDTH - width) / 2;
}

function buildSingleRow(n) {
    const usableWidth = getUsableWidth();
    const step = n > 1 ? usableWidth / (n - 1) : 0;
    const left = getFormationLeft(usableWidth);
    const y = HEIGHT / 2;
    const positions = [];
    for (let i = 0; i < n; i++) {
        positions.push({ x: left + i * step, y });
    }
    return positions;
}

function drawFacingArrow() {
    const x = MARGIN_X / 2;                 // слева от строя
    const topY = HEIGHT / 2 - ROW_GAP_Y;    // чуть выше центра
    const bottomY = HEIGHT / 2 + ROW_GAP_Y; // чуть ниже центра
    const headSize = 10;

    ctx.save();

    // Линия стрелки
    ctx.strokeStyle = '#6ec1ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY - headSize);
    ctx.stroke();

    // Наконечник (указывает вниз — направление «вперёд»)
    ctx.beginPath();
    ctx.moveTo(x - headSize / 2, bottomY - headSize);
    ctx.lineTo(x + headSize / 2, bottomY - headSize);
    ctx.lineTo(x, bottomY);
    ctx.closePath();
    ctx.fillStyle = '#6ec1ff';
    ctx.fill();

    // Подпись
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('вперёд', x, bottomY + 6);

    ctx.restore();
}


function buildFormation(n, rows) {
    const mid = Math.floor((rows + 1) / 2);

    const cols = Math.ceil(n / rows);

    const usableWidth = getUsableWidth();
    const frontStep = cols > 1 ? usableWidth / (cols - 1) : 0;
    const formationLeft = getFormationLeft((cols - 1) * frontStep);

    const positions = new Array(n);

    for (let i = 0; i < n; i++) {
        const col = Math.floor(i / rows);   // 0..cols-1 — слева направо
        const row = i % rows;               // 0..rows-1 — сверху вниз

        // X — по колонне
        const x = formationLeft + col * frontStep;

        // Y — по ряду; базовый (средний) ряд стоит на месте
        const k = row + 1;                  // номер по расчёту 1..rows
        const offsetRows = mid - k;
        const y = HEIGHT / 2 + offsetRows * ROW_GAP_Y;

        positions[i] = { x, y };
    }

    return positions;
}


function buildTarget(n, rows) {
    if (rows <= 1) return buildSingleRow(n);
    return buildFormation(n, rows);
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawFacingArrow();
    for (const p of currentPositions) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#6ec1ff';
        ctx.fill();
    }
}



function tick(now) {
    if (animating) {
        const t = Math.min((now - animStart) / ANIM_DURATION, 1);
        const e = easeInOut(t);
        for (let i = 0; i < currentPositions.length; i++) {
            const a = startPositions[i];
            const b = targetPositions[i];
            currentPositions[i].x = a.x + (b.x - a.x) * e;
            currentPositions[i].y = a.y + (b.y - a.y) * e;
        }
        if (t >= 1) animating = false;
    }
    draw();
    requestAnimationFrame(tick);
}

function rebuild() {
    const n = Math.max(2, Math.min(100, parseInt(document.getElementById('count').value, 10) || 10));
    document.getElementById('count').value = n;
    const rows = Math.max(1, Math.min(n, parseInt(document.getElementById('rows').value, 10) || 1));

    const newTarget = buildTarget(n, rows);

    if (currentPositions.length !== n) {
        startPositions = buildSingleRow(n);
        currentPositions = startPositions.map(p => ({ ...p }));
    } else {
        startPositions = currentPositions.map(p => ({ ...p }));
    }

    targetPositions = newTarget;
    animStart = performance.now();
    animating = true;
}

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        layout();

        const n = currentPositions.length;
        if (n === 0) return;
        const rows = parseInt(document.getElementById('rows').value, 10) || 1;

        targetPositions = buildTarget(n, rows);
        currentPositions = targetPositions.map(p => ({ ...p }));
        startPositions = targetPositions.map(p => ({ ...p }));
        animating = false;
        draw();
    }, 100);
});

(function fillRowOptions() {
    const sel = document.getElementById('rows');
    if (sel.options.length <= 1) {
        sel.innerHTML = '';
        for (let r = 1; r <= 10; r++) {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            if (r === 2) opt.selected = true;
            sel.appendChild(opt);
        }
    }
})();

// Убираем автозапуск перестроения. При старте — просто рисуем один ряд.
function init() {
    layout();

    const n = Math.max(2, Math.min(100, parseInt(document.getElementById('count').value, 10) || 10));
    const rows = parseInt(document.getElementById('rows').value, 10) || 1;

    // Стартовое состояние: один ряд, без анимации
    currentPositions = buildSingleRow(n);
    startPositions = currentPositions.map(p => ({ ...p }));
    targetPositions = buildTarget(n, rows);
    animating = false;

    draw();
}

document.getElementById('build').addEventListener('click', rebuild);

init();
requestAnimationFrame(tick);