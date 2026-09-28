import { CFG } from './config.js';

// Три шкалы от 0 до 100: еда, вода, силы. Любая на нуле — шмель засыпает.
export class Needs {
  constructor() { this.reset(); }
  reset() { this.food = 100; this.water = 100; this.energy = 100; }
  clamp() {
    this.food = Math.max(0, Math.min(100, this.food));
    this.water = Math.max(0, Math.min(100, this.water));
    this.energy = Math.max(0, Math.min(100, this.energy));
  }
  eat(v) { this.food += v; this.clamp(); }
  drink(v) { this.water += v; this.clamp(); }
  // flying — в воздухе, boost — с ускорением, resting — сидит, atHive — сидит у улья.
  update(dt, { flying, boost, resting, atHive }) {
    const n = CFG.needs;
    this.food -= n.foodPerSec * dt;
    this.water -= n.waterPerSec * dt;
    if (flying) this.energy -= (boost ? n.energyBoostPerSec : n.energyFlyPerSec) * dt;
    if (resting) this.energy += n.restPerSec * (atHive ? 2 : 1) * dt;
    this.clamp();
  }
  // Что кончилось: 'food' | 'water' | 'energy' | null.
  get empty() {
    if (this.food <= 0) return 'food';
    if (this.water <= 0) return 'water';
    if (this.energy <= 0) return 'energy';
    return null;
  }
  get tired() { return this.energy < CFG.needs.tiredBelow; }
}
