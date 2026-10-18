const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const ANIM_DURATION = 1200;      // опорная длительность (для «средней» дистанции)
const MAX_FORMATION_WIDTH = 1400;
const MAX_N = 400;
const MAX_T = 10;
const INITIAL_N = 4;

// Радиус точки
const R_MIN = 2.5;
const R_MAX = 6;

// Скорость «марша» — пикселей в секунду для опорной длительности.
// Реально скорость вычислим от геометрии, здесь — база для easeInOut.
const MARCH_SPEED = 600;         // px/сек

let WIDTH = 0;
let HEIGHT = 0;
let MARGIN_X = 0;
let MARGIN_Y = 0;
let DOT_RADIUS = R_MAX;

let startPositions = [];
let targetPositions = [];
let currentPositions = [];
let waypoints = [];               // для каждой точки: [start, pivot, target]
let segmentLengths = [];          // длины отрезков маршрута для каждой точки
let pointDurations = [];          // длительность анимации для каждой точки
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
}

function getUsableWidth() {
    const raw = WIDTH - 2 * MARGIN_X;
    return Math.min(raw, MAX_FORMATION_WIDTH);
}

// ---------- Список вариантов каре для заданной толщины t ----------

function kareVariants(t, maxN) {
    const result = [];
    const nMin = 4 * t * t;
    const step = 4 * t;
    for (let n = nMin; n <= maxN; n += step) {
        const m = n / (4 * t) + t;
        result.push({ n, m });
    }
    return result;
}

// ---------- Шеренга ----------

function buildSingleRow(n) {
    const usableWidth = getUsableWidth();
    const step = n > 1 ? usableWidth / (n - 1) : 0;
    const left = (WIDTH - usableWidth) / 2;
    const y = HEIGHT / 2;
    const positions = [];
    for (let i = 0; i < n; i++) {
        positions.push({ x: left + i * step, y });
    }
    return positions;
}

// ---------- Каре ----------
// Квадрат m x m со стенкой t. Слои снаружи внутрь.
// В каждом слое — периметр по часовой стрелке с нижнего левого угла.

function buildKareGeometry(m, t) {
    const usableW = getUsableWidth();
    const usableH = HEIGHT - 2 * MARGIN_Y;
    const step = Math.min(
        m > 1 ? usableW / (m - 1) : 0,
        m > 1 ? usableH / (m - 1) : 0
    );

    const originX = WIDTH / 2 - (m - 1) * step / 2;
    const originY = HEIGHT / 2 - (m - 1) * step / 2;

    const positions = [];

    for (let layer = 0; layer < t; layer++) {
        const lo = layer;
        const hi = m - 1 - layer;
        if (lo > hi) break;

        if (lo === hi) {
            positions.push({ x: originX + lo * step, y: originY + lo * step });
            continue;
        }

        // 1) нижняя сторона: слева направо
        for (let c = lo; c <= hi; c++) {
            positions.push({ x: originX + c * step, y: originY + hi * step });
        }
        // 2) правая сторона: снизу вверх, без нижнего угла
        for (let r = hi - 1; r >= lo; r--) {
            positions.push({ x: originX + hi * step, y: originY + r * step });
        }
        // 3) верхняя сторона: справа налево, без правого угла
        for (let c = hi - 1; c >= lo; c--) {
            positions.push({ x: originX + c * step, y: originY + lo * step });
        }
        // 4) левая сторона: сверху вниз, без верхнего и нижнего углов
        for (let r = lo + 1; r <= hi - 1; r++) {
            positions.push({ x: originX + lo * step, y: originY + r * step });
        }
    }

    return { positions, step, m };
}

function computeDotRadius(m, step) {
    // Радиус зависит от m и шага сетки
    const byStep = step * 0.35;
    const byM = 80 / Math.sqrt(m * m); // грубая эвристика
    const r = Math.min(R_MAX, Math.max(R_MIN, Math.min(byStep, byM)));
    return r;
}

// ---------- Построение маршрутов ----------
// Для каждой точки: [start, pivot, target].
// pivot — промежуточная точка: сначала идём по X, потом по Y.

function buildRoutes(start, target) {
    const routes = [];
    const segLens = [];
    const durations = [];

    for (let i = 0; i < start.length; i++) {
        const a = start[i];
        const b = target[i];
        const pivot = { x: b.x, y: a.y }; // сначала по X, потом по Y

        const dx1 = pivot.x - a.x;
        const dy1 = pivot.y - a.y;
        const dx2 = b.x - pivot.x;
        const dy2 = b.y - pivot.y;
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        const total = len1 + len2;

        routes.push([a, pivot, b]);
        segLens.push([len1, len2]);
        durations.push(total);
    }

    return { routes, segLens, durations };
}

// ---------- UI ----------

function fillThicknessOptions() {
    const sel = document.getElementById('thickness');
    sel.innerHTML = '';
    for (let t = 1; t <= MAX_T; t++) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        sel.appendChild(opt);
    }
}

function fillCountOptions() {
    const t = parseInt(document.getElementById('thickness').value, 10) || 1;
    const sel = document.getElementById('count');
    const prev = parseInt(sel.value, 10);

    sel.innerHTML = '';
    const variants = kareVariants(t, MAX_N);

    for (const { n, m } of variants) {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = `${n} (${m}×${m})`;
        sel.appendChild(opt);
    }

    if (variants.some(v => v.n === prev)) {
        sel.value = String(prev);
    }
}

// ---------- Перестроение ----------

function rebuild() {
    const t = parseInt(document.getElementById('thickness').value, 10) || 1;
    const n = parseInt(document.getElementById('count').value, 10);
    if (!n) return;

    const m = n / (4 * t) + t;

    const { positions: karePositions, step } = buildKareGeometry(m, t);
    DOT_RADIUS = computeDotRadius(m, step);

    // Старт всегда — шеренга из n точек
    startPositions = buildSingleRow(n);
    targetPositions = karePositions.slice(0, n);

    // Маршруты: для каждой точки [start, pivot, target]
    const { routes, segLens, durations } = buildRoutes(startPositions, targetPositions);
    waypoints = routes;
    segmentLengths = segLens;
    pointDurations = durations;

    // Текущие позиции начинаем с начала маршрута
    currentPositions = startPositions.map(p => ({ ...p }));

    animStart = performance.now();
    animating = true;
}

// ---------- Сброс ----------

function reset() {
    const n = currentPositions.length || INITIAL_N;
    currentPositions = buildSingleRow(n);
    startPositions = currentPositions.map(p => ({ ...p }));
    targetPositions = currentPositions.map(p => ({ ...p }));
    waypoints = [];
    segmentLengths = [];
    pointDurations = [];
    animating = false;
    draw();
}

// ---------- Отрисовка ----------

function drawFacingArrow() {
    const x = MARGIN_X / 2;
    const topY = HEIGHT / 2 - 40;
    const bottomY = HEIGHT / 2 + 40;
    const headSize = 10;

    ctx.save();
    ctx.strokeStyle = '#6ec1ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY - headSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - headSize / 2, bottomY - headSize);
    ctx.lineTo(x + headSize / 2, bottomY - headSize);
    ctx.lineTo(x, bottomY);
    ctx.closePath();
    ctx.fillStyle = '#6ec1ff';
    ctx.fill();

    ctx.fillStyle = '#9aa4b2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('вперёд', x, bottomY + 6);
    ctx.restore();
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

// ---------- Анимация ----------

function tick(now) {
    if (animating) {
        for (let i = 0; i < currentPositions.length; i++) {
            const route = waypoints[i];
            if (!route) continue;

            const [a, pivot, b] = route;
            const [len1, len2] = segmentLengths[i];
            const total = len1 + len2;

            // Длительность для этой точки при равной скорости:
            // длительность = дистанция / MARCH_SPEED, но не меньше опорной
            const ownDuration = total > 0
                ? Math.max(ANIM_DURATION * (total / MARCH_SPEED) / 2, 300)
                : 0;

            // Все стартуют одновременно: время t — общее, но у каждой точки
            // свой финиш. t нормируем по максимальной длительности среди всех.
            // Для простоты: общая длительность = max(pointDurations) / MARCH_SPEED,
            // но чтобы не усложнять — используем общий MAX_ANIM_DURATION.
            const elapsed = now - animStart;
            const tLocal = ownDuration > 0 ? Math.min(elapsed / ownDuration, 1) : 1;
            const e = easeInOut(tLocal);

            // Проходим маршрут по двум отрезкам
            const pos = moveAlong(a, pivot, b, len1, len2, e);
            currentPositions[i].x = pos.x;
            currentPositions[i].y = pos.y;
        }

        // Конец анимации — когда все дошли
        const allDone = waypoints.every((_, i) => {
            const [len1, len2] = segmentLengths[i];
            const total = len1 + len2;
            const ownDuration = total > 0
                ? Math.max(ANIM_DURATION * (total / MARCH_SPEED) / 2, 300)
                : 0;
            return now - animStart >= ownDuration;
        });
        if (allDone) animating = false;
    }
    draw();
    requestAnimationFrame(tick);
}

// Позиция на маршруте из двух отрезков по прогрессу e (0..1)
function moveAlong(a, pivot, b, len1, len2, e) {
    const total = len1 + len2;
    if (total === 0) return { x: a.x, y: a.y };
    const dist = e * total;

    if (dist <= len1) {
        const f = len1 > 0 ? dist / len1 : 0;
        return {
            x: a.x + (pivot.x - a.x) * f,
            y: a.y + (pivot.y - a.y) * f
        };
    } else {
        const f = len2 > 0 ? (dist - len1) / len2 : 0;
        return {
            x: pivot.x + (b.x - pivot.x) * f,
            y: pivot.y + (b.y - pivot.y) * f
        };
    }
}

// ---------- Ресайз ----------

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        layout();

        const n = currentPositions.length;
        if (n === 0) return;

        // Мгновенно перестроить в шеренгу (как «Сброс»)
        currentPositions = buildSingleRow(n);
        startPositions = currentPositions.map(p => ({ ...p }));
        targetPositions = currentPositions.map(p => ({ ...p }));
        animating = false;
        draw();
    }, 100);
});

// ---------- Старт ----------

fillThicknessOptions();
fillCountOptions();

document.getElementById('thickness').addEventListener('change', fillCountOptions);
document.getElementById('build').addEventListener('click', rebuild);
document.getElementById('reset').addEventListener('click', reset);

function init() {
    layout();
    currentPositions = buildSingleRow(INITIAL_N);
    startPositions = currentPositions.map(p => ({ ...p }));
    targetPositions = currentPositions.map(p => ({ ...p }));
    animating = false;
    draw();
}

init();
requestAnimationFrame(tick);