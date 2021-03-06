var util = require('util');
var PhysicsObject = require('./physics_object');

var chem = require('chem');
var v = chem.vec2d;

module.exports = Shield;

util.inherits(Shield, PhysicsObject);
function Shield(state, o) {
  PhysicsObject.call(this, state, o);

  this.team = o.team;
  this.radius = o.radius || 120;
  this.defense = 20;
  this.healthRechargeAmt = o.healthRechargeAmt || 0.002;

  this.canBeStruck = false;
  this.canBeShot = false;
  this.canGoOffscreen = true;
  this.reflectBullets = true;
}

Shield.prototype.name = "Shield";

Shield.prototype.draw = function(context) {
  context.globalAlpha = (this.health > 0.3) ? 1 : (this.health / 0.3);
  context.beginPath();
  context.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI);
  context.closePath();
  context.strokeStyle = this.team.color;
  context.stroke();
  context.globalAlpha = 1;

  var shieldPowerBarSize = v(32, 4);
  var start = this.pos.minus(shieldPowerBarSize.scaled(0.5)).floor();
  start.y -= this.radius + shieldPowerBarSize.y;
  context.fillStyle = "#000000";
  context.fillRect(start.x - 1, start.y - 1, shieldPowerBarSize.x + 2, shieldPowerBarSize.y + 2);
  context.fillStyle = this.team.color;
  context.fillRect(start.x, start.y, shieldPowerBarSize.x * this.health, shieldPowerBarSize.y);
};

Shield.prototype.update = function(dt, dx) {
  PhysicsObject.prototype.update.call(this, dt, dx);
  this.health = Math.min(1, this.health + dx * this.healthRechargeAmt);

  // collide with other shields
  for (var i = 0; i < this.state.physicsObjects.length; i += 1) {
    var obj = this.state.physicsObjects[i];
    if (obj.team === this.team) continue;
    if (!obj.reflectBullets) continue;
    var addedRadii = this.radius + obj.radius;
    if (obj.pos.distanceSqrd(this.pos) > addedRadii * addedRadii) continue;
    this.collide(obj);
  }
};

Shield.prototype.reflect = function(bullet) {
  if (!bullet.canHitShield) return false;
  var downShieldAmt = bullet.damageAmount / this.defense;
  if (this.health < downShieldAmt) return false;
  var withinRangeDistSqrd = bullet.radius * bullet.radius + this.radius * this.radius;
  if (bullet.pos.distanceSqrd(this.pos) > withinRangeDistSqrd) return false;
  bullet.collide(this);
  this.health = Math.max(0, this.health - downShieldAmt);
  return true;
}

Shield.prototype.mass = function() {
  return this.density * Math.PI * this.radius * this.radius * this.health;
};
