var PhysicsObject = require('./physics_object');
var parasiticInherits = require('./parasitic_inherits');
var util = require('util');
var chem = require('chem');
var EventEmitter = require('events').EventEmitter;
var v = chem.vec2d;
var ani = chem.resources.animations;

var MINIMUM_VELOCITY_SQRD = 0.001 * 0.001;
var MIN_BRAKE_VEL = 0.2;

module.exports = Ship;

// multiple inheritance in JavaScript. So sue me.
util.inherits(Ship, PhysicsObject);
parasiticInherits(Ship, EventEmitter);
function Ship(state, o) {
  PhysicsObject.apply(this, arguments);
  EventEmitter.call(this);

  this.team = o.team;
  this.health = o.health || 1;
  this.group = o.group;

  this.canBeShot = true;
  this.bounty = 5;
  // tells where it shows up in the squad
  this.rankOrder = 0;

  this.initResources(state);

  this.canBeSelected = true;
  this.sensorRange = 400; // radius of ability to detect ships
  this.thrustInput = 0;
  this.brakeInput = false; // lets you brake at low velocities
  this.rotateInput = 0;
  this.enterInput = null; // lets you enter buildings
  this.hasBackwardsThrusters = true;
  this.radius = 16;
  this.rotationSpeed = Math.PI * 0.03;
  this.thrustAmt = 0.1;
  this.hasBullets = false;
  this.canBeStruck = true;
  this.hostile = true;
  this.shield = null;

  this.miniMapColor = this.team.color;
  this.uiAnimationName = this.animationNames.still;
}

Ship.prototype.name = "Ship";

Ship.prototype.serialize = function() {
  return {
    type: "Ship",
    properties: {
      ship: {
        type: this.name,
        pos: this.pos.clone(),
        vel: this.vel.clone(),
        team: this.team.number,
        rotation: this.rotation,
      },
    },
  };
};

Ship.prototype.onTargeted = function(ship, action) {
  this.emit('targeted', ship, action);
}

Ship.prototype.clearInput = function() {
  this.setThrustInput(0);
  this.setRotateInput(0);
  this.brakeInput = false;
  this.enterInput = null;
};

Ship.prototype.setThrustInput = function(value, brake) {
  assert(Math.abs(value) <= 1);
  assert(value >= 0 || this.hasBackwardsThrusters);
  this.brakeInput = brake == null ? false : brake;
  if (this.thrustInput === value) return;
  if (value === 0) {
    this.thrustAudio.pause();
    if (this.thrustInput > 0) {
      this.sprite.setAnimation(ani[this.animationNames.decel]);
    } else {
      this.sprite.setAnimation(ani[this.animationNames.backwardsDecel]);
    }
  } else if (value > 0) {
    this.thrustAudio.play();
    this.sprite.setAnimation(ani[this.animationNames.accel]);
  } else if (value < 0) {
    this.thrustAudio.play();
    this.sprite.setAnimation(ani[this.animationNames.backwardsAccel]);
  }
  this.sprite.setFrameIndex(0);
  this.thrustInput = value;
};

Ship.prototype.setRotateInput = function(value) {
  this.rotateInput = value;
  if (this.rotateInput > 1) this.rotateInput = 1;
  if (this.rotateInput < -1) this.rotateInput = -1;
};

Ship.prototype.draw = function(context) {
  PhysicsObject.prototype.draw.apply(this, arguments);
  this.drawTeamColor(context);
}

Ship.prototype.drawState = function(context) {
  // call this method in draw when manually piloting it.
}

Ship.prototype.drawTeamColor = function(context) {
  context.beginPath();
  context.arc(this.sprite.pos.x, this.sprite.pos.y, 4, 0, 2 * Math.PI);
  context.closePath();
  context.fillStyle = this.team.color;
  context.fill();
};

Ship.prototype.enter = function(other) {
  other.enter(this);
  // we might get deleted by entering something.
  if (this.deleted) return;
  this.state.deletePhysicsObject(this);
  this.delete();
};

Ship.prototype.update = function(dt, dx) {
  PhysicsObject.prototype.update.apply(this, arguments);
  if (this.enterInput) {
    var addedRadii = this.radius + this.enterInput.radius;
    if (this.pos.distanceSqrd(this.enterInput.pos) < addedRadii * addedRadii) {
      this.enter(this.enterInput);
      return;
    }
  }
  this.rotation += this.rotateInput * this.rotationSpeed * dx;
  // clamp rotation
  this.rotation = this.rotation % (2 * Math.PI);
  var thrust = v.unit(this.rotation);
  this.vel.add(thrust.scaled(this.thrustInput * this.thrustAmt * dx));
  // if vel is close enough to 0, set it to 0
  var speedSqrd = this.vel.lengthSqrd();
  var minBrakeVel = Math.max(MIN_BRAKE_VEL, 2 * this.thrustAmt * this.thrustAmt);
  if (speedSqrd < MINIMUM_VELOCITY_SQRD || (this.brakeInput && speedSqrd < minBrakeVel))
  {
    this.vel.x = 0;
    this.vel.y = 0;
  }

  this.sprite.rotation = this.rotation + Math.PI / 2;
  this.sprite.pos = this.pos.floored();
};

Ship.prototype.damage = function(damage, explosionAnimationName) {
  this.health -= damage / this.defense;
  this.emit('hit');
  if (this.health <= 0) {
    this.state.createExplosion(this.pos, this.vel, explosionAnimationName);
    this.state.deletePhysicsObject(this);
    this.emit('destroyed');
    this.delete();
  }
};

Ship.prototype.initResources = function(state) {
  // sometimes we want to create a ship outside the context of a level player
  if (state == null) return;

  this.state = state;

  this.thrustAudio = new Audio("sfx/thruster.ogg");
  this.thrustAudio.loop = true;

  this.sprite = new chem.Sprite(ani[this.animationNames.still]);
  this.state.batch.add(this.sprite);
}

Ship.prototype.tearDownResources = function() {
  this.state = null;

  this.thrustAudio.pause();
  this.thrustAudio = null;

  this.sprite.delete();
  this.sprite = null;
};

Ship.prototype._delete = function() {
  this.emit('deleted');
  this.removeAllListeners();
  this.clearInput();
  this.tearDownResources();
};

Ship.prototype.undelete = function(state) {
  this.deleted = false;
  this.initResources(state);
};

function assert(value) {
  if (!value) throw new Error("Assertion Failure: " + value);
}
