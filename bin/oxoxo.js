"use strict";

require("../lib/use");

const _ = require("lodash");
const assert = require("assert");
const { chainable } = require("iterablefu");

const min = pos => Math.min.apply(Math, pos);
const max = pos => Math.max.apply(Math, pos);

class OXRules {
  constructor(size, dimensions) {
    Object.assign(this, { size, dimensions });
  }

  get nonNull() {
    return sl => sl.some(l => l.dp);
  }

  get canonical() {
    return line => {
      if (this.comparePos(line[0], line[line.length - 1]) <= 0) return line;
      return _.reverse(line.slice(0));
    };
  }

  get unique() {
    const seen = new Set();
    return line => {
      const lk = JSON.stringify(line);
      if (seen.has(lk)) return false;
      seen.add(lk);
      return true;
    };
  }

  get expandLines() {
    return sl => {
      let pos = sl.map(({ p }) => p);
      const delta = sl.map(({ dp }) => dp);
      const out = [];
      while (min(pos) >= 0 && max(pos) < this.size) {
        out.push(pos);
        pos = _.zip(pos, delta).map(([p, dp]) => p + dp);
      }
      return out;
    };
  }

  comparePos(pos1, pos2) {
    for (const [p1, p2] of _.zip(pos1, pos2)) {
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  get canonical() {
    return line => {
      if (this.comparePos(line[0], line[line.length - 1]) <= 0) return line;
      return _.reverse(line.slice(0));
    };
  }

  get unique() {
    const seen = new Set();
    return line => {
      const lk = JSON.stringify(line);
      if (seen.has(lk)) return false;
      seen.add(lk);
      return true;
    };
  }

  get winningLines() {
    function* makeLines(sz, dim) {
      if (dim === 0) {
        yield [];
        return;
      }

      for (const lines of makeLines(sz, dim - 1)) {
        yield [...lines, { p: 0, dp: 1 }];
        yield [...lines, { p: sz - 1, dp: -1 }];
        for (let p = 0; p < sz; p++) yield [...lines, { p, dp: 0 }];
      }
    }

    return chainable(makeLines(this.size, this.dimensions))
      .filter(this.nonNull)
      .map(this.expandLines)
      .map(this.canonical)
      .filter(this.unique);
  }

  get slots() {
    return Math.pow(this.size, this.dimensions);
  }

  makeBoard() {
    return new Array(this.slots).fill(0);
  }

  slotToPos(slot) {
    const { size, dimensions } = this;
    const pos = [];
    for (let i = 0; i < dimensions; i++) {
      pos.unshift(slot % size);
      slot = Math.floor(slot / size);
    }
    return pos;
  }

  posToSlot(pos) {
    const { size, dimensions } = this;
    let slot = 0;
    for (const p of pos) slot = slot * size + p;
    return slot;
  }
}

class OXPlayer {
  constructor(id) {
    Object.assign(this, { id });
  }

  play(game, plays) {
    const { rules, players, board } = game;
    //        for (const play of plays.survey) console.log(JSON.stringify(play));
    for (let need = 1; need <= rules.size; need++) {
      const lines = plays.filter(l => l.need === need).linesByID;
      //      console.log({need, lines});
      for (const id of [this.id, ...players.map(p => p.player.id), "*"]) {
        const next = lines[id];
        //        console.log({id, next});
        if (next) {
          const pos = game.freeSlots(next.survey[0].line)[0];
          game.set(pos, this.id);
          return true;
        }
      }
    }
    return false;
  }
}

class OXPlays {
  constructor(survey) {
    this.survey = survey;
  }

  get length() {
    return this.survey.length;
  }

  filter(pred) {
    return new this.constructor(this.survey.filter(pred));
  }

  get wonLines() {
    return this.filter(l => l.need === 0);
  }

  get winningLines() {
    return this.filter(l => l.need === 1);
  }

  get linesByID() {
    return _.mapValues(
      _.groupBy(this.survey, "id"),
      lines => new this.constructor(lines)
    );
  }

  get linesBySlot() {
    const getBySlot = () => {
      const bySlot = {};
      for (const path of this.survey) {
        for (const pos of path.line) {
          const key = JSON.stringify(pos);
          (bySlot[key] = bySlot[key] || []).push(path);
        }
      }
      return bySlot;
    };

    return (this._linesBySlot = this._linesBySlot || getBySlot());
  }
}

class OXGame {
  constructor(rules, players, board) {
    this.rules = rules;
    this.players = players.map(player => ({ player, didPlay: true }));
    this.board = this.board || this.rules.makeBoard();
  }

  lookAlong(line) {
    const { rules, board } = this;
    return line.map(pos => rules.posToSlot(pos)).map(slot => board[slot]);
  }

  countAlong(line) {
    const count = {};
    const pop = this.lookAlong(line);
    for (const p of pop) count[p] = (count[p] || 0) + 1;
    return count;
  }

  freeSlots(line) {
    const { rules, board } = this;
    return line.filter(pos => board[rules.posToSlot(pos)] === 0);
  }

  getSurvey() {
    const { rules, board } = this;

    const survey = [];
    const note = (id, count, line) => {
      const need = this.rules.size - count;
      survey.push({ id, need, line });
    };

    for (const line of rules.winningLines) {
      const pop = this.countAlong(line);
      if (!pop[0]) continue;
      delete pop[0];
      const found = Object.entries(pop);
      if (found.length > 1) continue;
      if (found.length) {
        const [id, count] = found[0].map(Number);
        note(id, count, line);
      } else {
        note("*", 0, line);
      }
    }
    return survey;
  }

  getPlays() {
    return new OXPlays(this.getSurvey());
  }

  get(pos) {
    const { rules, board } = this;
    return board[rules.posToSlot(pos)];
  }

  set(pos, id) {
    const { rules, board } = this;
    const slot = rules.posToSlot(pos);
    const other = board[slot];
    if (other !== 0)
      throw new Error(`${JSON.stringify(pos)} already taken by ${other}`);
    board[slot] = id;
    return this;
  }

  play() {
    const { players } = this;
    const plays = this.getPlays();
    if (plays.wonLines.length) return true;
    const next = players.shift();
    if (!next.didPlay) {
      players.push(next);
      return true;
    }
    next.didPlay = next.player.play(this, plays);
    players.push(next);
    return false;
  }

  showBoard() {
    const symbol = [".", "O", "X", "A"];
    return _.chunk(this.board.map(s => symbol[s]), this.rules.size)
      .map(row => row.join(""))
      .join("\n");
  }
}

const rules = new OXRules(4, 3);
const players = chainable
  .range(3)
  .map(n => new OXPlayer(n + 1))
  .toArray();
const game = new OXGame(rules, players);

console.log(game.showBoard());
while (true) {
  if (game.play()) break;
  console.log("");
  console.log(game.showBoard());
}

//for (const sl of rules.winningLines) console.log(JSON.stringify(sl));
