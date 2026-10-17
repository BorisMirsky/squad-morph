const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const DOT_RADIUS = 6;
const ANIM_DURATION = 1200;
const MAX_FORMATION_WIDTH = 1400;

let WIDTH = 0;
let HEIGHT = 0;
let MARGIN_X = 0;
let MARGIN_Y = 0;
let ROW_GAP_Y = 0;

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

function getUsableWidth() {
    const raw = WIDTH - 2 * MARGIN_X;
    return Math.min(raw, MAX_FORMATION_WIDTH);
}

function getFormationLeft(width) {
    return (WIDTH - width) / 2;
}

// ---------- Один ряд ----------

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

// ---------- N рядов (колонны) ----------
// Договорённость: «вперёд» = вниз экрана.
// Первый ряд (k=1) — передний, внизу; последний (k=rows) — задний, вверху.
// Неполная колонна заполняется с переднего ряда, задние остаются пустыми.

function buildFormation(n, rows) {
    const mid = Math.floor((rows + 1) / 2);
    const cols = Math.ceil(n / rows);

    const usableWidth = getUsableWidth();
    const frontStep = cols > 1 ? usableWidth / (cols - 1) : 0;
    const formationLeft = getFormationLeft((cols - 1) * frontStep);

    const positions = new Array(n);

    for (let i = 0; i < n; i++) {
        const col = Math.floor(i / rows);
        const row = i % rows;

        const x = formationLeft + col * frontStep;

        const k = row + 1;
        const offsetRows = mid - k;
        const y = HEIGHT / 2 + offsetRows * ROW_GAP_Y;

        positions[i] = { x, y };
    }

    return positions;
}

// ---------- Каре ----------
// Квадрат m×m, заполняем по периметру.
// Обход по часовой стрелке, начиная с переднего левого угла
// (передняя сторона внизу — «вперёд» = вниз).
// Если n < m² — заполняем периметр по порядку обхода.

function buildSquare(n) {
    const m = Math.ceil(Math.sqrt(n));

    // Шаг сетки каре — вписываем квадрат (m-1)*step в доступную область
    const usableW = getUsableWidth();
    const usableH = HEIGHT - 2 * MARGIN_Y;
    const step = Math.min(
        m > 1 ? usableW / (m - 1) : 0,
        m > 1 ? usableH / (m - 1) : 0
    );

    // Центр каре по центру экрана
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // Левый верхний угол каре
    const originX = cx - (m - 1) * step / 2;
    const originY = cy - (m - 1) * step / 2;

    // Собираем позиции периметра по часовой стрелке,
    // но начинаем с переднего левого угла (внизу-слева),
    // т.е. (col=0, row=m-1), где row 0 — верх, row m-1 — низ.
    // Для удобства построим координаты в терминах (col, row) сетки,
    // затем переведём в пиксели.

    // Порядок обхода:
    // 1) передняя сторона (низ): col 0..m-1, row m-1
    // 2) правая сторона: col m-1, row m-2..0
    // 3) задняя сторона (верх): col m-2..0, row 0
    // 4) левая сторона: col 0, row 1..m-2
    const perimeter = [];
    if (m === 1) {
        perimeter.push({ c: 0, r: 0 });
    } else {
        // 1) низ, слева направо
        for (let c = 0; c < m; c++) perimeter.push({ c, r: m - 1 });
        // 2) право, снизу вверх (без нижнего угла)
        for (let r = m - 2; r >= 0; r--) perimeter.push({ c: m - 1, r });
        // 3) верх, справа налево (без правого угла)
        for (let c = m - 2; c >= 0; c--) perimeter.push({ c, r: 0 });
        // 4) лево, сверху вниз (без верхнего и нижнего углов)
        for (let r = 1; r <= m - 2; r++) perimeter.push({ c: 0, r });
    }

    const count = Math.min(n, perimeter.length);
    const positions = new Array(count);

    for (let i = 0; i < count; i++) {
        const { c, r } = perimeter[i];
        positions[i] = {
            x: originX + c * step,
            y: originY + r * step
        };
    }

    return positions;
}

// ---------- Выбор целевой фигуры ----------

function buildTarget(n, rows, shape) {
    if (shape === 'square') return buildSquare(n);
    if (rows <= 1) return buildSingleRow(n);
    return buildFormation(n, rows);
}

// ---------- Отрисовка ----------

function drawFacingArrow() {
    const x = MARGIN_X / 2;
    const topY = HEIGHT / 2 - ROW_GAP_Y;
    const bottomY = HEIGHT / 2 + ROW_GAP_Y;
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

// ---------- Перестроение ----------

function readInputs() {
    const n = Math.max(2, Math.min(100, parseInt(document.getElementById('count').value, 10) || 10));
    document.getElementById('count').value = n;
    const rows = Math.max(1, Math.min(n, parseInt(document.getElementById('rows').value, 10) || 1));
    const shape = document.getElementById('shape').value;
    return { n, rows, shape };
}

function rebuild() {
    const { n, rows, shape } = readInputs();

    const newTarget = buildTarget(n, rows, shape);

    // Если изменилось число точек — стартуем из одного ряда.
    // Если нет — стартуем из текущего положения.
    if (currentPositions.length !== n) {
        startPositions = buildSingleRow(n);
        currentPositions = startPositions.map(p => ({ ...p }));
    } else {
        startPositions = currentPositions.map(p => ({ ...p }));
    }

    // Для каре целевых позиций может быть меньше, чем точек (n > m²).
    // В этом случае лишние точки не анимируются в новые места,
    // а «схлопываются» — для простоты оставляем их на последних позициях.
    // Практически: выравниваем длины — обрезаем или дублируем последнюю.
    if (newTarget.length < n) {
        while (newTarget.length < n) {
            newTarget.push({ ...newTarget[newTarget.length - 1] });
        }
    } else if (newTarget.length > n) {
        newTarget.length = n;
    }

    targetPositions = newTarget;
    animStart = performance.now();
    animating = true;
}

// ---------- Ресайз ----------

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        layout();

        const n = currentPositions.length;
        if (n === 0) return;
        const { rows, shape } = readInputs();

        targetPositions = buildTarget(n, rows, shape);
        if (targetPositions.length < n) {
            while (targetPositions.length < n) {
                targetPositions.push({ ...targetPositions[targetPositions.length - 1] });
            }
        } else if (targetPositions.length > n) {
            targetPositions.length = n;
        }

        currentPositions = targetPositions.map(p => ({ ...p }));
        startPositions = targetPositions.map(p => ({ ...p }));
        animating = false;
        draw();
    }, 100);
});

// ---------- Старт ----------

(function fillRowOptions() {
    const sel = document.getElementById('rows');
    sel.innerHTML = '';
    for (let r = 1; r <= 10; r++) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        if (r === 2) opt.selected = true;
        sel.appendChild(opt);
    }
})();

document.getElementById('build').addEventListener('click', rebuild);

function init() {
    layout();

    const { n } = readInputs();

    currentPositions = buildSingleRow(n);
    startPositions = currentPositions.map(p => ({ ...p }));
    targetPositions = currentPositions.map(p => ({ ...p }));
    animating = false;

    draw();
}

init();
requestAnimationFrame(tick);