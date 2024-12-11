const canvas = document.getElementById('mainCanvas');
const context = canvas.getContext('2d');
let width = canvas.width;
let height = canvas.height;
let aspect = height / width;

let NUM_VERLET_ITERATIONS = 3;
let repellentForce = 500;

let stickCorrectionForce = 0.001;

const wallBounceDamping = 0.78;
let gravity = 0.04;
let friction = 0.011;
const borderOffset = 3;

let targetPullForce = 0.001;

let points = [];
let sticks = [];

let activePoint = undefined;
let pullPosition = undefined;

// ui state flags
let simulationMode = 'init';
let autoChainMode = true;

let useGravity = false;

// cannot use last element in array because we look for similar points and do not readd them
// in this case we have to keep a reference to the last similar point
let lastPointAdded = null;

context.lineWidth = 3;

function addListeners() {
  document.getElementById('sliderGravityLabel').innerHTML = `Gravity: <b>${gravity}</b>`;
  document.getElementById('sliderGravity').value = gravity;
  document.getElementById('sliderGravity').addEventListener('input', event => {
    gravity = Number(event.target.value);
    document.getElementById('sliderGravityLabel').innerHTML = `Gravity: <b>${event.target.value}</b>`;
  });

  document.getElementById('sliderFrictionLabel').innerHTML = `Friction: <b>${friction}</b>`;
  document.getElementById('sliderFriction').value = friction;
  document.getElementById('sliderFriction').addEventListener('input', event => {
    friction = Number(event.target.value);
    document.getElementById('sliderFrictionLabel').innerHTML = `Friction: <b>${event.target.value}</b>`;
  });

  document.getElementById('repellentForceLabel').innerHTML = `Repellent force: <b>${repellentForce}</b>`;
  document.getElementById('repellentForce').value = repellentForce;
  document.getElementById('repellentForce').addEventListener('input', event => {
    repellentForce = Number(event.target.value);
    document.getElementById('repellentForceLabel').innerHTML = `Repellent force: <b>${event.target.value}</b>`;
  });

  document.getElementById('targetPullForceLabel').innerHTML = `Target pull force: <b>${targetPullForce}</b>`;
  document.getElementById('targetPullForce').value = targetPullForce;
  document.getElementById('targetPullForce').addEventListener('input', event => {
    targetPullForce = Number(event.target.value);
    document.getElementById('targetPullForceLabel').innerHTML = `Target pull force: <b>${event.target.value}</b>`;
  });

  document.getElementById(
    'stickCorrectionForceLabel',
  ).innerHTML = `Stick correction force: <b>${stickCorrectionForce}</b>`;
  document.getElementById('stickCorrectionForce').value = targetPullForce;
  document.getElementById('stickCorrectionForce').addEventListener('input', event => {
    stickCorrectionForce = Number(event.target.value);
    document.getElementById(
      'stickCorrectionForceLabel',
    ).innerHTML = `Stick correction force: <b>${event.target.value}</b>`;
  });

  document.getElementById('numVerletIterationsLabel').innerHTML = `Verlet iterations: <b>${NUM_VERLET_ITERATIONS}</b>`;
  document.getElementById('numVerletIterations').value = NUM_VERLET_ITERATIONS;
  document.getElementById('numVerletIterations').addEventListener('input', event => {
    NUM_VERLET_ITERATIONS = Number(event.target.value);
    document.getElementById('numVerletIterationsLabel').innerHTML = `Verlet iterations: <b>${event.target.value}</b>`;
  });
}

addListeners();

function resizeCanvas() {
  canvas.style.width = window.innerWidth - 20;
  canvas.style.width = window.innerHeight - 20;
}

window.addEventListener('resize', resizeCanvas);

resizeCanvas();

const lerp = (x, y, t) => (1 - t) * x + t * y;

function length({ x, y }) {
  return Math.sqrt(x * x + y * y);
}

function distance(p0, p1) {
  const dX = p1.x - p0.x;
  const dY = p1.y - p0.y;

  return Math.sqrt(dX * dX + dY * dY);
}

function update() {
  if (simulationMode === 'running') {
    updatePoints();

    for (let i = 0; i < NUM_VERLET_ITERATIONS; ++i) {
      updateSticks();
      constrainBorders();
    }
  }

  context.clearRect(0, 0, width, height);

  renderSticks();
  renderPoints();
  renderPullGizmo();

  requestAnimationFrame(update);
}

// applies physics to the points
function updatePoints() {
  points.forEach(p => {
    if (p.fixed) {
      return;
    }

    vX = p.x - p.prevX;
    vY = p.y - p.prevY;

    points.forEach(otherP => {
      if (otherP.x === p.x && otherP.y === p.y) {
        return;
      }

      // TODO: we check points pairwise, but also, we check each pair twice, as Pa, Pb and as Pb, Pa
      if (p.isCenter || otherP.isCenter) {
        return;
      }

      const dist = distance(p, otherP);

      // heuristic for same point, could be 0, but we choose our parameters so that initially points do not coincide
      if (dist < 1 || isNaN(dist)) {
        return;
      }

      const repellentVector = repellentForce / (dist * dist);

      const pullVecX = ((p.x - otherP.x) / dist) * repellentVector;
      const pullVecY = ((p.y - otherP.y) / dist) * repellentVector;

      vX += pullVecX;
      vY += pullVecY;
    });

    vX *= 1 - friction;
    vY *= 1 - friction;

    p.prevX = p.x;
    p.prevY = p.y;

    // TODO: time step dependence
    p.x += vX;
    p.y += vY;

    // apply gravity
    // TODO: convert between coordinate systems so we can subtract gravity and this becomes less confusing
    // MIND: gravity is an accelerating force, so it should alter velocity to be strict
    // this here will have the same end result since the change in position will result in reduced gravity during next update

    if (useGravity) {
      p.y += gravity;
    }
  });

  if (pullPosition) {
    let bestDistance = Infinity;
    let updatedActivePoint = undefined;

    points.forEach(p => {
      const pointDistance = distance(p, pullPosition);
      if (pointDistance < bestDistance) {
        bestDistance = pointDistance;
        updatedActivePoint = p;
      }
    });

    activePoint = updatedActivePoint;
  }

  if (activePoint && pullPosition) {
    const pullVec = {
      x: (pullPosition.x - activePoint.x) * targetPullForce,
      y: (pullPosition.y - activePoint.y) * targetPullForce,
    };

    const len = length(pullVec);

    // if (len > maxPullG) {
    //   pullVec.x = (pullVec.x / len) * maxPullG;
    //   pullVec.y = (pullVec.y / len) * maxPullG;
    // }

    activePoint.x += pullVec.x;
    activePoint.y += pullVec.y;

    //activePoint.x = lerp(activePoint.x, pullPosition.x, pullStrength);
    //activePoint.y = lerp(activePoint.y, pullPosition.y, pullStrength);
  }
}

// constraints point position with the sticks
function updateSticks() {
  sticks.forEach(s => {
    const dX = s.p1.x - s.p0.x;
    const dY = s.p1.y - s.p0.y;

    const currentLength = distance(s.p0, s.p1);
    const dLength = currentLength - s.length;

    const relativeLengthChange = dLength / currentLength;

    const offsetX = dX * stickCorrectionForce * relativeLengthChange;
    const offsetY = dY * stickCorrectionForce * relativeLengthChange;

    // this is a strictly speaking more correct implementation,
    // but the code below works just as well due to the iterations
    /*
    if (s.p0.fixed && s.p1.fixed) {
      return;
    }
    // if either of the points is fixed,
    // the other one has to compensate for the whole dLength, so we double the offsets again
    else if (s.p0.fixed) {
      s.p1.x += 2 * offsetX;
      s.p1.y += 2 * offsetY;

      return;
    } else if (s.p1.fixed) {
      s.p0.x -= 2 * offsetX;
      s.p0.y -= 2 * offsetY;

      return;
    }
    */

    if (!s.p0.fixed) {
      s.p0.x += offsetX;
      s.p0.y += offsetY;
    }
    if (!s.p1.fixed) {
      s.p1.x -= offsetX;
      s.p1.y -= offsetY;
    }
  });
}

function constrainBorders() {
  points.forEach(p => {
    if (p.fixed) {
      return;
    }

    // bounce at borders
    if (p.x > width - borderOffset) {
      p.x = width - borderOffset;
      p.prevX = p.x + vX * wallBounceDamping;
    }
    if (p.x < borderOffset) {
      p.x = borderOffset;
      p.prevX = p.x + vX * wallBounceDamping;
    }
    if (p.y > height - borderOffset) {
      p.y = height - borderOffset;
      p.prevY = p.y + vY * wallBounceDamping;
    }
    if (p.y < borderOffset) {
      p.y = borderOffset;
      p.prevY = p.y + vY * wallBounceDamping;
    }
  });
}

function renderPoints() {
  points.forEach(p => {
    if (p === lastPointAdded) {
      context.fillStyle = 'red';
    } else {
      context.fillStyle = p.fixed ? 'aqua' : 'black';
    }

    context.beginPath();
    context.arc(p.x, p.y, 4, 0, Math.PI * 2);
    context.fill();
  });
}

function renderPullGizmo() {
  if (simulationMode === 'running') {
    if (activePoint) {
      context.fillStyle = 'orange';

      context.beginPath();
      context.arc(activePoint.x, activePoint.y, 2, 0, Math.PI * 2);
      context.fill();
    }
    if (pullPosition) {
      context.fillStyle = 'green';

      context.beginPath();
      context.arc(pullPosition.x, pullPosition.y, 2, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function renderSticks() {
  context.beginPath();
  sticks.forEach(s => {
    context.moveTo(s.p0.x, s.p0.y);
    context.lineTo(s.p1.x, s.p1.y);
  });

  context.stroke();
}

function renderMoveVector() {
  context.beginPath();

  context.moveTo(points[0]);
  context.lineTo(s.p1.x, s.p1.y);

  context.stroke();
}

function createStartPoint(angle, radius) {
  const x = Math.cos(angle) * radius + 600 - 50 + Math.random() * 100;
  const y = Math.sin(angle) * radius + 600 - 50 + Math.random() * 100;

  const speedInferScale = 0.6;

  // const prevX = Math.cos(angle) * speedInferScale * radius + 600;
  // const prevY = Math.sin(angle) * speedInferScale * radius + 600;

  return {
    x,
    y,
    prevX: x,
    prevY: y,
  };
}

function init() {
  points = [];
  sticks = [];

  const centerPoint = {
    x: 600,
    y: 600,
    prevX: 600,
    prevY: 600,
    isCenter: true,
  };

  points.push(centerPoint);

  for (let i = 0; i < 10; ++i) {
    const newPoint = createStartPoint((Math.PI / 5) * i, 200);

    points.push(newPoint);

    sticks.push({
      p0: centerPoint,
      p1: newPoint,
      length: 200,
    });
  }

  lastPointAdded = null;
}

window.onload = function () {
  init();

  // start render loop
  update();
};

function updateStartPauseButtonLabel() {
  document.getElementById('startPauseButton').innerHTML =
    {
      init: 'Start',
      paused: 'Resume',
      running: 'Pause',
    }[simulationMode] || 'missing label';
}

function updateGravityButtonLabel() {
  document.getElementById('toggleGravity').innerHTML = useGravity ? 'Gravity: <b>on</b>' : 'Gravity: <b>off</b>';
}

function toggleSimulation() {
  if (simulationMode === 'init' || simulationMode === 'paused') {
    simulationMode = 'running';
  } else {
    simulationMode = 'paused';
  }

  updateStartPauseButtonLabel();
}

function resetSimulation() {
  init();
  simulationMode = 'init';

  updateStartPauseButtonLabel();
  updateGravityButtonLabel();
}

function toggleGravity() {
  useGravity = !useGravity;

  updateGravityButtonLabel();
}

document.getElementById('mainCanvas').onclick = function (event) {
  const rect = event.target.getBoundingClientRect();
  const clickXpos = event.clientX - rect.left;
  const clickYpos = event.clientY - rect.top;

  const canvasXpos = (clickXpos / rect.width) * 1200;
  const canvasYpos = (clickYpos / rect.height) * 1200;

  const similarPoint = points.find(p => distance(p, { x: canvasXpos, y: canvasYpos }) < 4);

  const updatedPullPosition = {
    x: canvasXpos,
    y: canvasYpos,
    prevX: canvasXpos,
    prevY: canvasYpos,
  };

  if (simulationMode === 'running') {
    if (similarPoint) {
      activePoint = similarPoint;
    }
    if (pullPosition && distance(updatedPullPosition, pullPosition) < 7) {
      pullPosition = undefined;
    } else {
      pullPosition = updatedPullPosition;
    }

    return;
  }
};

const toggleChainMode = () => {
  autoChainMode = !autoChainMode;
};
