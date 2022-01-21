const canvas = document.getElementById("mainCanvas");
const context = canvas.getContext("2d");
let width = canvas.width;
let height = canvas.height;
let aspect = height / width;

const points = [];

const bounceDamping = 0.93;
const gravity = 0.3;
const friction = 0.994;

function update() {
  updatePoints();
  renderPoints();
  requestAnimationFrame(update);
}

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
  context.clearRect(0, 0, width, height);
  points.forEach((p) => {
    context.beginPath();
    context.arc(p.x, p.y, 2, 0, Math.PI * 2);
    context.fill();
  });
}

window.onload = function () {
  points.push({
    x: 15,
    y: 95,
    prevX: 14,
    prevY: 94,
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
