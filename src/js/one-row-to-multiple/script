const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const WIDTH = 900;
const HEIGHT = 500;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const DOT_RADIUS = 6;
const ANIM_DURATION = 1200; // мс

// Отступы от краёв, чтобы точки не прилипали
const MARGIN_X = 80;
const MARGIN_Y = 80;

let startPositions = [];
let targetPositions = [];
let currentPositions = [];
let animStart = 0;
let animating = false;

// Утилита: плавное ускорение/замедление
function easeInOut(t) {
    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Построение одного ряда
function buildSingleRow(n) {
    const usableWidth = WIDTH - 2 * MARGIN_X;
    const step = n > 1 ? usableWidth / (n - 1) : 0;
    const y = HEIGHT / 2;
    const positions = [];
    for (let i = 0; i < n; i++) {
        positions.push({ x: MARGIN_X + i * step, y });
    }
    return positions;
}

// Построение 2 рядов: каждый второй делает шаг назад и встаёт позади предыдущего
function buildTwoRows(n) {
    const usableWidth = WIDTH - 2 * MARGIN_X;
    const rowStepX = n > 1 ? usableWidth / (n - 1) : 0;
    const rowGapY = 60; // расстояние между рядами

    // Верхний ряд (передний) — чётные индексы
    // Нижний ряд (задний) — нечётные
    const frontY = HEIGHT / 2 - rowGapY / 2;
    const backY = HEIGHT / 2 + rowGapY / 2;

    const frontCount = Math.ceil(n / 2);

    // Разложим передний ряд равномерно по всей ширине
    const frontStep = frontCount > 1 ? usableWidth / (frontCount - 1) : 0;

    const positions = new Array(n);

    for (let i = 0; i < n; i++) {
        if (i % 2 === 0) {
            // чётный — остаётся в переднем ряду
            const k = i / 2;
            positions[i] = {
                x: MARGIN_X + k * frontStep,
                y: frontY
            };
        } else {
            // нечётный — встаёт позади предыдущего чётного
            const prev = positions[i - 1];
            positions[i] = {
                x: prev.x,
                y: backY
            };
        }
    }

    return positions;
}

// Выбор целевого построения по числу рядов
function buildTarget(n, rows) {
    if (rows === 1) return buildSingleRow(n);
    if (rows === 2) return buildTwoRows(n);
    return buildSingleRow(n); // задел на будущее
}

// Отрисовка
function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const p of currentPositions) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#6ec1ff';
        ctx.fill();
    }
}

// Цикл анимации
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

// Запуск перестроения
function rebuild() {
    const n = Math.max(2, Math.min(100, parseInt(document.getElementById('count').value, 10) || 10));
    document.getElementById('count').value = n;
    const rows = parseInt(document.getElementById('rows').value, 10);

    const newTarget = buildTarget(n, rows);

    if (currentPositions.length !== n) {
        // Первый запуск или смена количества — стартуем из одного ряда
        startPositions = buildSingleRow(n);
        currentPositions = startPositions.map(p => ({ ...p }));
    } else {
        startPositions = currentPositions.map(p => ({ ...p }));
    }

    targetPositions = newTarget;
    animStart = performance.now();
    animating = true;
}

document.getElementById('build').addEventListener('click', rebuild);

// Стартовая инициализация
rebuild();
requestAnimationFrame(tick);