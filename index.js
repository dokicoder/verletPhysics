const canvas = document.getElementById('mainCanvas');
const context = canvas.getContext('2d');
let width = canvas.width;
let height = canvas.height;
let aspect = height / width;

const NUM_VERLET_INTEGRATIONS = 3;
const bounceDamping = 0.78;
const gravity = 0.04;
const friction = 0.992;
const borderOffset = 3;

let pullStrength = 0.001;
const maxPullG = 0.04;

let points = [];
let sticks = [];

let activePoint = undefined;
let pullPosition = undefined;

// ui state flags
let simulationMode = 'init';
let autoChainMode = true;

let useGravity = true;

// cannot use last element in array because we look for similar points and do not readd them
// in this case we have to keep a reference to the last similar point
let lastPointAdded = null;

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

    for (let i = 0; i < NUM_VERLET_INTEGRATIONS; ++i) {
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

    vX = (p.x - p.prevX) * friction;
    vY = (p.y - p.prevY) * friction;

    p.prevX = p.x;
    p.prevY = p.y;

    // TODO: time step dependence
    p.x += vX;
    p.y += vY;

    // apply gravity
    // TODO: convert between coordinate systems so we can subtract gravity and this becomes less confusing
    // MIND: gravity is an accelerating force, so it should alter velocity to be strict
    // thishere will have the same end result since the change in position will result in reduced gravity during next update

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
      x: (pullPosition.x - activePoint.x) * pullStrength,
      y: (pullPosition.y - activePoint.y) * pullStrength,
    };

    const len = length(pullVec);

    if (len > maxPullG) {
      pullVec.x = (pullVec.x / len) * maxPullG;
      pullVec.y = (pullVec.y / len) * maxPullG;
    }

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

    const offsetX = dX * 0.5 * relativeLengthChange;
    const offsetY = dY * 0.5 * relativeLengthChange;

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
      p.prevX = p.x + vX * bounceDamping;
    } else if (p.x < borderOffset) {
      p.x = borderOffset;
      p.prevX = p.x + vX * bounceDamping;
    }
    if (p.y > height - borderOffset) {
      p.y = height - borderOffset;
      p.prevY = p.y + vY * bounceDamping;
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
    context.arc(p.x, p.y, 2, 0, Math.PI * 2);
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

function init() {
  points = [];
  sticks = [];

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
  document.getElementById('toggleGravity').innerHTML = useGravity
    ? 'Gravity: <b>on</b>'
    : 'Gravity: <b>off</b>';
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

  const canvasXpos = (clickXpos / rect.width) * 500;
  const canvasYpos = (clickYpos / rect.height) * 500;

  const similarPoint = points.find(
    p => distance(p, { x: canvasXpos, y: canvasYpos }) < 4,
  );

  if (simulationMode === 'running') {
    if (similarPoint) {
      activePoint = similarPoint;
    } else {
      pullPosition = {
        x: canvasXpos,
        y: canvasYpos,
        prevX: canvasXpos,
        prevY: canvasYpos,
      };
    }

    return;
  }

  if (similarPoint && points.length) {
    if (autoChainMode) {
      const p0 = lastPointAdded;
      const p1 = similarPoint;

      sticks.push({
        p0,
        p1,
        length: distance(p0, p1),
      });
    }

    lastPointAdded = similarPoint;
  } else {
    points.push({
      x: canvasXpos,
      y: canvasYpos,
      prevX: canvasXpos,
      prevY: canvasYpos,
      // for testing: make first point fixture by default
      fixed: points.length === 0,
    });

    if (points.length >= 2) {
      if (autoChainMode) {
        const p0 = lastPointAdded;
        const p1 = points[points.length - 1];

        sticks.push({
          p0,
          p1,
          length: distance(p0, p1),
        });
      }
    }

    lastPointAdded = points[points.length - 1];
  }
};

const toggleChainMode = () => {
  autoChainMode = !autoChainMode;
};

/*
window.onresize = function () {
  canvas.width = document.getElementById("main").width;
  canvas.height = document.getElementById("main").height;
  width = canvas.width;
  height = canvas.height;
  aspect = height / width;
};
*/
