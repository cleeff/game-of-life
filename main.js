"use strict";

let canvas;
let ctx;
let mouse_down = false;
let base_unit = window.devicePixelRatio; // Screen pixel in canvas coordinates.
let last_update = null;
let ups = 0;
let fps = 0;
let draw_last_update = null;
let step_count = 0;
const rows = 500;
const cols = 500;
const offset = 20;

let grid = Array(rows).fill(0).map(x => Array(cols).fill(false));
let new_grid = Array(rows).fill(0).map(x => Array(cols).fill(false));

window.onload = init;

function init() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  changeViewport();
  initView();
  window.requestAnimationFrame(gameLoop);

  const gosperglidergun = `x = 36, y = 9, rule = B3/S23
    24bo11b$22bobo11b$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$2o8b
    o3bob2o4bobo11b$10bo5bo7bo11b$11bo3bo20b$12b2o!`
  loadRle(gosperglidergun);
}

function gameLoop(time_stamp) {
  clear_view();
  draw_fps(time_stamp);
  draw();

  // Keep requesting new frames
  window.requestAnimationFrame(gameLoop);
}

function clear_view() {
  const upper_left = transformedPoint(0, 0);
  const lower_right = transformedPoint(window.innerWidth, window.innerHeight);

  // Clear the entire canvas
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function draw_fps(time_stamp) {
  ctx.fillText(step_count, 10, 0);
  ctx.fillText(ups.toFixed(0), 10, 10);

  const draw_time_diff = time_stamp - draw_last_update;
  draw_last_update = time_stamp;
  fps = 0.9 * fps + 0.1 * 1000 / draw_time_diff;
  ctx.fillText(fps.toFixed(0), 10, 20);
}

function draw() {
  const upper_left = transformedPoint(0, 0);
  const lower_right = transformedPoint(window.innerWidth, window.innerHeight);
  ctx.strokeStyle = "#fff";
  for (let i = Math.floor(upper_left.x); i <= Math.ceil(lower_right.x); i++) {
    if (i % 5 == 0) { ctx.lineWidth = 0.02; }
    else { ctx.lineWidth = 0.01; }
    ctx.beginPath();
    ctx.moveTo(i, upper_left.y);
    ctx.lineTo(i, lower_right.y);
    ctx.stroke();
  }
  for (let j = Math.floor(upper_left.y); j <= Math.ceil(lower_right.y); j++) {
    if (j % 5 == 0) { ctx.lineWidth = 0.02; }
    else { ctx.lineWidth = 0.01; }
    ctx.beginPath();
    ctx.moveTo(upper_left.x, j);
    ctx.lineTo(lower_right.x, j);
    ctx.stroke();
  }
  const min_i = Math.max(0, Math.floor(upper_left.x));
  const max_i = Math.min(rows, Math.ceil(lower_right.x));
  const min_j = Math.max(0, Math.floor(upper_left.y));
  const max_j = Math.min(cols, Math.ceil(lower_right.y));
  for (let i = min_i; i < max_i; i++) {
    for (let j = min_j; j < max_j; j++) {
      if (grid[i][j]) {
        ctx.fillStyle = 'white';
        ctx.fillRect(i, j, 1, 1);
      }
    }
  }
}

function transformedPoint(x, y) {
  const originalPoint = new DOMPoint(x * window.devicePixelRatio, y * window.devicePixelRatio);
  return ctx.getTransform().invertSelf().transformPoint(originalPoint);
}

function initView() {
  const cells_to_show = 100;
  const target_width = cells_to_show;
  const scale = target_width / canvas.width;
  base_unit *= scale;
  ctx.scale(1 / scale, 1 / scale);
}

function changeViewport() {
  const transform = ctx.getTransform();
  // Set display size (css pixels).
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  // Set actual size in memory (scaled to account for extra pixel density).
  // NOTE: This means that mouse px coordinates need to be multiplied 
  // by devicePixelRatio to match canvas coordinates.
  // window.devicePixelRatio = 2 on retina displays.
  const width = Math.floor(window.innerWidth * window.devicePixelRatio);
  const height = Math.floor(window.innerHeight * window.devicePixelRatio);
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(transform);
}

function step() {
  step_count++;

  // Compute the number of alive neighbors for each cell
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let neighbors = 0;
      for (let row = Math.max(0, i - 1); row <= Math.min(rows - 1, i + 1); row++) {
        for (let col = Math.max(0, j - 1); col <= Math.min(cols - 1, j + 1); col++) {
          if (row === i && col === j) continue;
          if (grid[row][col]) neighbors++;
        }
      }
      if (grid[i][j]) {
        new_grid[i][j] = neighbors >= 2 && neighbors <= 3;
      } else {
        new_grid[i][j] = neighbors === 3;
      }
    }
  }
  [grid, new_grid] = [new_grid, grid];

  const now = performance.now();
  const time_diff = now - last_update;
  last_update = now;
  ups = 0.9 * ups + 0.1 * 1000 / time_diff;
}

var timer = {
  running: false,
  delay: 200,
  timeoutId: null,
  callback: function () { },
  start: function (callback, delay) {
    var element = this;
    clearInterval(this.timeoutId); // In case start was called while timeout was running
    this.running = true;
    if (callback) this.callback = callback;
    if (delay) this.delay = delay;
    this.timeoutId = setTimeout(function () { element.execute(element) }, this.delay);
  },
  execute: function (e) {
    if (!e.running) return;
    e.callback();
    e.start();
  },
  stop: function () {
    clearInterval(this.timeoutId);
    this.running = false;
  },
  set_interval: function (delay) {
    this.delay = delay;
  }
};

onresize = (event) => {
  changeViewport();
};
onmousemove = (event) => {
  if (mouse_down === false) return;
  const offset_x = event.movementX * base_unit;
  const offset_y = event.movementY * base_unit;
  ctx.translate(offset_x, offset_y);
}
onmousedown = (event) => {
  mouse_down = { x: event.x, y: event.y };
}
onmouseup = (event) => {
  if (Math.abs(event.offsetX - mouse_down.x) + Math.abs(event.offsetY - mouse_down.y) <= 10) {
    const pt = transformedPoint(event.offsetX, event.offsetY);
    const x = Math.floor(pt.x);
    const y = Math.floor(pt.y);
    if (x >= 0 && x < rows && y >= 0 && y < cols) {
      grid[x][y] = !grid[x][y];
    }
  }
  mouse_down = false;
}
onwheel = (event) => {
  const scale = 1 + event.deltaY / 500;
  base_unit *= scale;
  const pt = transformedPoint(event.offsetX, event.offsetY);
  ctx.translate(pt.x, pt.y);
  ctx.scale(1 / scale, 1 / scale);
  ctx.translate(-pt.x, -pt.y);
}
onkeydown = (event) => {
  if (event.key === ' ') {
    if (timer.running) {
      timer.stop();
    } else {
      timer.start(function () { step(); });
    }
  }
  else if (event.key === 'x') {
    // slower
    timer.set_interval(timer.delay * 1.3);
  }
  else if (event.key === 'l') {
    // faster
    timer.set_interval(timer.delay / 1.3);
  }
  else if (event.key === '.') {
    step();
  }
  else if (event.key === '0') {
    changeViewport();
  }
}

function loadRle(text) {
  const lines = text.split("\n");
  let width = null, height = null;
  let long_line = "";
  for (let line of lines) {
    line = line.trim();
    if (line[0] == '#') continue;
    else if (line[0] == 'x') {
      const parts = line.split(", ");
      width = parts[0].split("x = ").pop();
      height = parts[1].split("y = ").pop();
      const rule = parts[2].split("rule = ").pop().trim();
      if (rule.toLowerCase() !== "b3/s23") {
        console.error(`Could not read file: Unknown rule: ${rule}`)
        return;
      }
    } else {
      if (width === null || height === null) {
        console.error("Lacking width/height line");
        return;
      }
      long_line += line;
    }
  }
  if (long_line[long_line.length - 1] !== "!") {
    console.error("File should end with \"!\"");
    return;
  }
  long_line = long_line.split("!")[0];
  let line_idx = 0;
  let num = "";
  let x = 0;
  for (let ch of long_line) {
    if ('0' <= ch && ch <= '9') {
      num += ch;
    } else if (ch == 'o') {
      const count = parseInt(num) || 1;
      for (let i = 0; i < count; i++) {
        grid[offset + x++][offset + line_idx] = true;
      }
      num = ""
    } else if (ch == 'b') {
      const count = parseInt(num) || 1;
      x += count; // Nothing else do to for dead cells, already empty.
      num = "";
    } else if (ch == '$') {
      const count = parseInt(num) || 1;
      num = "";
      x = 0;
      line_idx += count;
    } else {
      console.error(`Unexpected character ${ch}`);
    }
  }
}
