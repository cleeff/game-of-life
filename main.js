const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let mouse_down = false;
let base_unit = window.devicePixelRatio; // Screen pixel in canvas coordinates.
const rows = 100;
const cols = 100;

let grid = [];
for (let i = 0; i < rows; i++) {
  grid[i] = [];
  for (let j = 0; j < cols; j++) {
    grid[i][j] = 0;
  }
}

function transformedPoint(x, y) {
  const originalPoint = new DOMPoint(x * window.devicePixelRatio, y * window.devicePixelRatio);
  return ctx.getTransform().invertSelf().transformPoint(originalPoint);
}

function initView() {
  const cells_to_show = 50;
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

function draw() {
  const upper_left = transformedPoint(0, 0);
  const lower_right = transformedPoint(window.innerWidth, window.innerHeight);

  // Clear the entire canvas
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  ctx.fillStyle = "#000";
  ctx.lineWidth = 0.01;
  for (let i = Math.floor(upper_left.x); i <= Math.ceil(lower_right.x); i++) {
    ctx.beginPath();
    ctx.moveTo(i, upper_left.y);
    ctx.lineTo(i, lower_right.y);
    ctx.stroke();
  }
  for (let j = Math.floor(upper_left.y); j <= Math.ceil(lower_right.y); j++) {
    ctx.beginPath();
    ctx.moveTo(upper_left.x, j);
    ctx.lineTo(lower_right.x, j);
    ctx.stroke();
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] === 1) {
        ctx.fillStyle = 'black';
        ctx.fillRect(i, j, 1, 1);
      }
    }
  }
}

function step() {
  // Create a copy of the grid
  let newGrid = grid.map(row => row.slice());

  // Compute the number of alive neighbors for each cell
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let neighbors = 0;
      for (let ii = -1; ii <= 1; ii++) {
        for (let jj = -1; jj <= 1; jj++) {
          if (ii === 0 && jj === 0) continue;
          const row = i + ii;
          const col = j + jj;
          if (row < 0 || row >= rows || col < 0 || col > cols) continue;
          if (grid[row][col] === 1) neighbors++;
        }
      }

      // Apply the Game of Life rules
      if (grid[i][j] === 1) {
        if (neighbors < 2 || neighbors > 3) newGrid[i][j] = 0;
      } else {
        if (neighbors === 3) newGrid[i][j] = 1;
      }
    }
  }

  // Update the grid
  grid = newGrid;
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

changeViewport();
initView();
draw();

onresize = (event) => {
  changeViewport();
  draw();
};
onmousemove = (event) => {
  if (mouse_down === false) return;
  const offset_x = event.movementX * base_unit;
  const offset_y = event.movementY * base_unit;
  ctx.translate(offset_x, offset_y);
  draw();
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
      grid[x][y] = 1 - grid[x][y];
      draw();
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
  draw();
}
onkeydown = (event) => {
  if (event.key === ' ') {
    if (timer.running) {
      timer.stop();
    } else {
      timer.start(function () { step(); draw(); });
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
    draw();
  }
  else if (event.key === '0') {
    changeViewport();
    draw();
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
      if (rule !== "B3/S23") {
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
  const rows = long_line.split("$");
  for (line_idx = 0; line_idx < rows.length; line_idx++) {
    const line = rows[line_idx];
    let num = "";
    let j = 0;
    for (const i in line) {
      if ('0' <= line[i] && line[i] <= '9') {
        num += line[i];
      } else if (line[i] == 'o'){
        count = parseInt(num) || 1;
        for (let i = 0; i < count; i++) { 
          grid[2 + j++][2 + line_idx] = 1;
        }
        num = "";
      } else if (line[i] == 'b'){
        count = parseInt(num) || 1;
        for (let i = 0; i < count; i++) { 
          j++; // Nothing else do to for dead cells
        }
        num = "";
      }
      else {
        console.error(`Unexpected character ${line[i]}`);
      }
    }
  }
  draw();
}

fetch("patterns/gosperglidergun.rle")
  .then((response) => {
    if (!response.ok) {
      console.log(`HTTP error: ${response.status}`);
    }
    return response.text();
  })
  .then((text) => loadRle(text));
