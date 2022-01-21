const canvas = document.getElementById("mainCanvas");
const context = canvas.getContext("2d");
let width = canvas.width;
let height = canvas.height;
let aspect = height / width;

const points = [];
const sticks = [];

const bounceDamping = 0.93;
const gravity = 0.3;
const friction = 0.994;

function distance(p0, p1) {
  const dX = p1.x - p0.x;
  const dY = p1.y - p0.y;

  return Math.sqrt(dX * dX + dY * dY);
}

function update() {
  updatePoints();
  updateSticks();

  constrainBorders();

  context.clearRect(0, 0, width, height);

  renderSticks();
  renderPoints();

  requestAnimationFrame(update);
}

// applies physics to the points
function updatePoints() {
  points.forEach((p) => {
    vX = (p.x - p.prevX) * friction;
    vY = (p.y - p.prevY) * friction;

    p.prevX = p.x;
    p.prevY = p.y;

    // TODO: time step dependence
    p.x += vX;
    p.y += vY;

    // apply gravity
    // TODO: convert between coordinate systems so we cab substract gravity and this becomes less confusing
    // MIND: gravity is an accelerating force, so it should alter velocity to be strict
    // this will result in the same though since the change in position will result in reduced gravity in next update
    p.y += gravity;
  });
}

// constraints point position with the sticks
function updateSticks() {
  sticks.forEach((s) => {
    const dX = s.p1.x - s.p0.x;
    const dY = s.p1.y - s.p0.y;

    const currentLength = distance(s.p0, s.p1);
    const dLength = currentLength - s.length;

    const relativeLengthChange = dLength / currentLength;

    const offsetX = dX * 0.5 * relativeLengthChange;
    const offsetY = dY * 0.5 * relativeLengthChange;

    s.p0.x += offsetX;
    s.p0.y += offsetY;

    s.p1.x -= offsetX;
    s.p1.y -= offsetY;
  });
}

function constrainBorders() {
  points.forEach((p) => {
    // bounce at borders
    if (p.x > width) {
      p.x = width;
      p.prevX = p.x + vX * bounceDamping;
    }
    if (p.y > height) {
      p.y = height;
      p.prevY = p.y + vY * bounceDamping;
    }
  });
}

function renderPoints() {
  points.forEach((p) => {
    context.beginPath();
    context.arc(p.x, p.y, 2, 0, Math.PI * 2);
    context.fill();
  });
}

function renderSticks() {
  context.beginPath();
  sticks.forEach((s) => {
    context.moveTo(s.p0.x, s.p0.y);
    context.lineTo(s.p1.x, s.p1.y);
  });

  context.stroke();
}

window.onload = function () {
  points.push({
    x: 15,
    y: 95,
    prevX: 14,
    prevY: 94,
  });
  points.push({
    x: 120,
    y: 80,
    prevX: 120,
    prevY: 80,
  });

  sticks.push({
    p0: points[0],
    p1: points[1],
    length: distance(points[0], points[1]),
  });

  // start render loop
  update();
};

/*
window.onresize = function () {
  canvas.width = window.getElementById("main").width;
  canvas.height = window.getElementById("main").height;
  width = canvas.width;
  height = canvas.height;
  aspect = height / width;
};
*/
