"use strict";

let canvas; // canvas element
let ctx; // 2d context
let active = new Set(); // currently active coordinates 
let changed = new Set(); // coordinates which changed since last iteration

let mouse_down = false; // is the left mouse button currently pushed down?
let base_unit; // pixel to screen coordinates ratio
let last_update = null; // timestamp of last step() update
let last_frame_update = null; // timestamp of last draw() update
let ups = 0; // updates per second, moving average using exponential smoothing
let fps = 0; // frames per second, moving average using exponential smoothing
let step_count = 0; // number of step() calls so far
const offset = 20; // coordinate offset for loaded patterns

/** Initialization when page is loaded. */
function init() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  changeViewport();
  initView();
  window.requestAnimationFrame(gameLoop);

  fetch('patterns/f-pentomino.rle')
    //fetch('patterns/otcametapixel.rle')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Could not load file.');
      }
      return response.text();
    })
    .then((text) => { loadRle(text) })
    .catch(() => {
      const gosperglidergun = `x = 36, y = 9, rule = B3/S23
    24bo11b$22bobo11b$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$2o8b
    o3bob2o4bobo11b$10bo5bo7bo11b$11bo3bo20b$12b2o!`
      loadRle(gosperglidergun);
    });
}

/** Draw loop which calls itself repeatedly. Has 60 fps on my test environment. */
function gameLoop(time_stamp) {
  clear_view();
  draw_fps(time_stamp);
  draw();

  // Keep requesting new frames
  window.requestAnimationFrame(gameLoop);
}

/** Set the view to a black background. */
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

/** Draw FPS and other stats on fixed position on screen. */
function draw_fps(time_stamp) {
  const upper_left = transformedPoint(0, 0);
  const lower_right = transformedPoint(window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "80px monospace";
  const draw_time_diff = time_stamp - last_frame_update;
  last_frame_update = time_stamp;
  fps = 0.9 * fps + 0.1 * 1000 / draw_time_diff;
  const steps = `${step_count} steps`.padStart(15);
  const ups_str = `${ups.toFixed(0)} UPS`.padStart(15);
  const fps_str = `${fps.toFixed(0)} FPS`.padStart(15);
  const text = steps + ups_str + fps_str;
  ctx.fillText(text, 50, 150);
  ctx.restore();
}

/** Draw the world on canvas. */
function draw() {
  const upper_left = transformedPoint(0, 0);
  const lower_right = transformedPoint(window.innerWidth, window.innerHeight);

  // Draw grid lines
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

  // Fill populated cells.
  ctx.fillStyle = 'white';
  for (const point of active) {
    const parts = point.split(',');
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    ctx.fillRect(x, y, 1, 1);
  }
}

// pixel coordinates -> world coordinates
function transformedPoint(x, y) {
  const originalPoint = new DOMPoint(x * window.devicePixelRatio, y * window.devicePixelRatio);
  return ctx.getTransform().invertSelf().transformPoint(originalPoint);
}

/** Initialize ctx transform and set the visible world section. */
function initView() {
  const cells_to_show = 100;
  const target_width = cells_to_show;
  const scale = target_width / canvas.width;
  base_unit = window.devicePixelRatio * scale; // Screen pixel in canvas coordinates.
  ctx.setTransform(1 / scale, 0, 0, 1 / scale, 0, 0);
}

/** Change the canvas dimensions because the user visible window has changed. */
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

/** Advance the world by one time step. */
function step() {
  step_count++;
  let candidates = new Set();
  for (const point of changed) {
    const parts = point.split(',');
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    for (let dx = -1; dx <= 1; ++dx) {
      for (let dy = -1; dy <= 1; ++dy) {
        candidates.add(`${x + dx},${y + dy}`);
      }
    }
  }
  changed.clear();
  let to_die = [];
  let to_be_born = [];
  for (const point of candidates) {
    const parts = point.split(',');
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    let neighbors = 0;
    for (let dx = -1; dx <= 1; ++dx) {
      for (let dy = -1; dy <= 1; ++dy) {
        if (dx === 0 && dy === 0) continue;
        if (active.has(`${x + dx},${y + dy}`)) {
          neighbors++;
        }
      }
    }
    if (active.has(point)) {
      if (neighbors !== 2 && neighbors !== 3) {
        to_die.push(point);
        changed.add(point);
      }
    } else {
      if (neighbors === 3) {
        to_be_born.push(point);
        changed.add(point);
      }
    }
  }
  for (const point of to_die) {
    active.delete(point);
  }
  for (const point of to_be_born) {
    active.add(point);
  }

  const now = performance.now();
  const time_diff = now - last_update;
  last_update = now;
  ups = 0.9 * ups + 0.1 * 1000 / time_diff;
}

/** Simple class which allows repeated function calls with changing delay. */
var timer = {
  running: false,
  delay: 20,
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

/** Mouse + Keyboard event handler. */
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
    const point = `${x},${y}`;
    if (active.has(point)) {
      active.delete(point);
    } else {
      active.add(point);
    }
    changed.add(point);
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
      timer.start(step);
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
  } else if (event.key === '0') {
    initView();
  } 
}

/** Load rle string and apply to world. */
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
        const point = `${offset + x++},${offset + line_idx}`;
        active.add(point);
        changed.add(point);
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

window.onload = init;
