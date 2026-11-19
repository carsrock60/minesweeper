/**
 * Aquifer — Modern Minesweeper
 * Clean, logic-driven implementation matching the Aquifer UI/UX spec.
 */

const CONFIG = {
  EASY: { rows: 9, cols: 9, mines: 10 },
  MEDIUM: { rows: 16, cols: 16, mines: 40 },
  HARD: { rows: 30, cols: 16, mines: 99 },
};

const CELL_SIZES = {
  EASY: { cell: 32, gap: 3 },
  MEDIUM: { cell: 30, gap: 3 },
  HARD: { cell: 26, gap: 2 },
};

class Game {
  constructor(mode = "EASY") {
    this.gameContainer = document.getElementById("game-board");
    this.timerLabel = document.getElementById("timer");
    this.mineLabel = document.getElementById("mine-count");
    this.statusLine = document.getElementById("status");
    this.winBanner = document.getElementById("result-banner");
    this.flagToggleButton = document.getElementById("flag-toggle");
    this.cellRootElement = this.gameContainer;

    this.reset(mode);
  }

  reset(mode = "EASY") {
    this.mode = mode;
    this.config = CONFIG[mode];
    this.rows = this.config.rows;
    this.cols = this.config.cols;
    this.mines = this.config.mines;

    this.grid = [];
    this.cellElements = [];
    for (let r = 0; r < this.rows; r++) {
      const rowCells = [];
      const rowData = [];
      for (let c = 0; c < this.cols; c++) {
        rowData.push({
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          isWrongFlag: false,
          neighborCount: 0,
          row: r,
          col: c,
        });
        rowCells.push(null);
      }
      this.grid.push(rowData);
      this.cellElements.push(rowCells);
    }

    this.firstClick = true;
    this.gameActive = true;
    this.gameOver = false;
    this.mineCount = this.mines;
    this.turnCount = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.flagModeActive = false;

    this.clearBanners();
    this.updateStatus("ready");
    this.mineLabel.innerText = this.mines;
    this.timerLabel.innerText = "00:00.00";

    this.createBoard();

    console.log(
      `Aquifer game started: ${this.rows}×${this.cols} with ${this.mines} mines.`,
    );

    window.game = this;
  }

  createBoard() {
    const sizes = CELL_SIZES[this.mode] || CELL_SIZES.EASY;

    this.gameContainer.innerHTML = "";
    if (!this.gameContainer.classList.contains("board")) {
      this.gameContainer.classList.add("board");
    }

    this.gameContainer.style.display = "grid";
    this.gameContainer.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.gameContainer.style.gap = `${sizes.gap}px`;
    this.gameContainer.style.maxHeight = `${Math.min(this.rows * (sizes.cell + sizes.gap) + 20, 560)}px`;
    this.gameContainer.style.overflowY = "auto";

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cellDiv = document.createElement("div");
        cellDiv.className = "cell";
        cellDiv.setAttribute("role", "gridcell");
        cellDiv.setAttribute(
          "aria-label",
          `Cell row ${r + 1}, column ${c + 1}, unrevealed.`,
        );
        cellDiv.style.width = `${sizes.cell}px`;
        cellDiv.style.height = `${sizes.cell}px`;
        cellDiv.style.fontSize = cellDiv.style.fontSize || "";

        const revealHandler = () => this.handleInput(r, c, "reveal");
        const flagHandler = () => this.handleInput(r, c, "flag");

        cellDiv.addEventListener("click", revealHandler);
        cellDiv.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          flagHandler();
        });

        cellDiv.addEventListener("pointerdown", (e) => {
          if (e.button === 2) return;
          if (!this.gameActive || this.gameOver) return;

          const cell = this.grid[r][c];
          if (cell.isRevealed) {
            this.handleChord(r, c);
          }
        });

        this.cellElements[r][c] = cellDiv;
      }
    }
  }

  handleInput(r, c, intent) {
    if (!this.gameActive || this.gameOver) return;

    const cell = this.grid[r][c];
    if (cell.isRevealed) {
      this.handleChord(r, c);
      return;
    }

    if (intent === "flag" || this.flagModeActive) {
      this.toggleFlag(r, c);
      return;
    }

    if (this.firstClick) {
      this.firstClick = false;
      this.generateMinesAvoiding(r, c);
      this.startTimer();
      this.reveal(r, c);
      return;
    }

    if (cell.isFlagged) return;

    this.reveal(r, c);
  }

  generateMinesAvoiding(safeR, safeC) {
    const forbidden = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        forbidden.add(`${safeR + dr},${safeC + dc}`);
      }
    }

    let minesPlaced = 0;
    while (minesPlaced < this.mines) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (this.grid[r][c].isMine) continue;
      if (forbidden.has(`${r},${c}`)) continue;

      this.grid[r][c].isMine = true;
      minesPlaced++;
    }

    this.calculateNeighborCounts();
  }

  calculateNeighborCounts() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c].neighborCount = 0;
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].isMine) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (this.isValid(nr, nc)) {
              this.grid[nr][nc].neighborCount++;
            }
          }
        }
      }
    }
  }

  reveal(r, c) {
    if (!this.gameActive) return;
    if (!this.isValid(r, c)) return;

    const cell = this.grid[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;

    if (cell.isMine) {
      this.gameOver = true;
      this.gameActive = false;
      this.stopTimer();
      this.showLoss();
      this.revealAllMines();
      return;
    }

    this.updateCellDisplay(r, c);

    if (cell.neighborCount === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (this.isValid(nr, nc)) {
            this.reveal(nr, nc);
          }
        }
      }
    } else {
      this.updateStatus("playing");
      this.checkWin();
    }
  }

  handleChord(r, c) {
    if (!this.gameActive || this.gameOver) return;

    const cell = this.grid[r][c];
    if (!cell.isRevealed || cell.neighborCount === 0) return;

    const flags = this.countFlagsAround(r, c);
    if (flags !== cell.neighborCount) return;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!this.isValid(nr, nc)) continue;

        const target = this.grid[nr][nc];
        if (target.isRevealed || target.isFlagged) continue;

        target.isRevealed = true;
        if (target.isMine) {
          this.gameOver = true;
          this.gameActive = false;
          this.stopTimer();
          this.showLoss();
          this.revealAllMines();
          return;
        }
        this.updateCellDisplay(nr, nc);
        if (target.neighborCount === 0) {
          for (let ddR = -1; ddR <= 1; ddR++) {
            for (let ddC = -1; ddC <= 1; ddC++) {
              if (ddR === 0 && ddC === 0) continue;
              const nnr = nr + ddR;
              const nnc = nc + ddC;
              if (this.isValid(nnr, nnc)) {
                this.reveal(nnr, nnc);
              }
            }
          }
        }
      }
    }

    this.checkWin();
  }

  toggleFlag(r, c) {
    if (!this.gameActive) return;
    if (!this.isValid(r, c)) return;

    const cell = this.grid[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    if (cell.isFlagged) {
      cell.isWrongFlag = false;
    }

    this.updateCellDisplay(r, c);
    this.updateStatus(
      this.gameOver ? "lost" : this.isWon() ? "won" : "playing",
    );
    this.mineLabel.innerText = this.mines - this.flagCount();

    if (this.isWon()) {
      this.gameOver = true;
      this.gameActive = false;
      this.stopTimer();
      this.showWin();
    }
  }

  updateCellDisplay(r, c) {
    const cell = this.grid[r][c];
    const element = this.cellElements[r][c];
    if (!element) return;

    const leaveRevealed = cell.isRevealed;

    if (leaveRevealed) {
      if (cell.isMine) {
        element.classList.add("cell--mine");
        element.innerHTML = this.mineSvg(true);
        element.setAttribute(
          "aria-label",
          `Cell row ${r + 1}, column ${c + 1}, mine.`,
        );
        return;
      }

      element.classList.add("cell--revealed");
      element.classList.remove("cell--flagged", "cell--wrong-flag");

      if (cell.neighborCount === 0) {
        element.classList.add("cell--empty");
        element.innerHTML = "";
        element.setAttribute(
          "aria-label",
          `Cell row ${r + 1}, column ${c + 1}, empty.`,
        );
        return;
      }

      element.classList.remove("cell--empty");
      element.innerHTML = this.numberSpan(cell.neighborCount);
      element.setAttribute(
        "aria-label",
        `Cell row ${r + 1}, column ${c + 1}, number ${cell.neighborCount}.`,
      );
      return;
    }

    if (cell.isFlagged) {
      cell.isWrongFlag = false;
    }

    element.classList.remove(
      "cell--revealed",
      "cell--empty",
      "cell--mine",
      "cell--wrong-flag",
    );

    if (cell.isFlagged) {
      element.classList.add("cell--flagged");
      element.innerHTML = this.flagSvg();
      element.setAttribute(
        "aria-label",
        `Cell row ${r + 1}, column ${c + 1}, flagged.`,
      );
      return;
    }

    element.classList.remove("cell--flagged");
    element.classList.add("cell");
    element.innerHTML = "";
    element.setAttribute(
      "aria-label",
      `Cell row ${r + 1}, column ${c + 1}, unrevealed.`,
    );
  }

  numberSpan(n) {
    return `<span class="num-${n}">${n}</span>`;
  }

  flagSvg() {
    return (
      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">` +
      `<path d="M4.2 21L20.5 4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M4.2 21H18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M18.5 4.6V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M18.5 9H19.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`
    );
  }

  mineSvg(exploding = false) {
    return (
      `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" class="mine-svg">` +
      `<circle cx="12" cy="12" r="6" stroke="#0A192F" stroke-width="2" fill="currentColor"/>` +
      `<circle cx="12" cy="12" r="2.2" fill="#0A192F"/>` +
      `</svg>`
    );
  }

  getNumericColor(count) {
    return (
      {
        1: "var(--num-1)",
        2: "var(--num-2)",
        3: "var(--num-3)",
        4: "var(--num-4)",
        5: "var(--num-5)",
        6: "var(--num-6)",
        7: "var(--num-7)",
        8: "var(--num-8)",
      }[count] || "var(--text)"
    );
  }

  isValid(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  countFlagsAround(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!this.isValid(nr, nc)) continue;
        if (this.grid[nr][nc].isFlagged) count++;
      }
    }
    return count;
  }

  flagCount() {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c].isFlagged) count++;
      }
    }
    return count;
  }

  startTimer() {
    if (this.timerInterval) return;
    if (this.startTime === null) {
      this.startTime = performance.now();
      this.timerInterval = setInterval(() => this.tick(), 50);
    }
  }

  tick() {
    if (this.startTime === null) return;
    const elapsed = performance.now() - this.startTime;
    this.timerLabel.innerText = formatTime(elapsed);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.startTime !== null) {
      this.timerLabel.innerText = formatTime(
        performance.now() - this.startTime,
      );
    }
    this.startTime = null;
  }

  showWin() {
    if (this.winBanner) {
      this.winBanner.setAttribute("data-state", "won");
      this.winBanner.innerHTML = `
        <div class="win-banner">
          <div><strong>Board cleared!</strong></div>
          <div>Completed in <time id="final-time">${this.timerLabel.innerText}</time></div>
          <button class="play-again" type="button" id="play-again-won">Play Again</button>
        </div>
      `;
      this.winBanner.classList.remove("win-banner-hidden");
      const wonButton = this.winBanner.querySelector("#play-again-won");
      if (wonButton) {
        wonButton.addEventListener("click", () => this.reset(this.mode));
      }
    }
  }

  showLoss() {
    if (this.winBanner) {
      this.winBanner.setAttribute("data-state", "lost");
      this.winBanner.innerHTML = `
        <div class="loss-banner">
          <div><strong>Boom.</strong></div>
          <button class="play-again" type="button" id="play-again-lost">Try Again</button>
        </div>
      `;
      this.winBanner.classList.remove("win-banner-hidden");
      const lostButton = this.winBanner.querySelector("#play-again-lost");
      if (lostButton) {
        lostButton.addEventListener("click", () => this.reset(this.mode));
      }
    }
  }
  destroy() {
    this.stopTimer();
    if (this.gameContainer && this.gameContainer.parentNode) {
      this.gameContainer.parentNode.removeChild(this.gameContainer);
    }
  }

  clearBoard() {
    this.stopTimer();
    this.clearBanners();
    this.gameContainer.innerHTML = "";
    this.cellElements = [];
    this.grid = [];
  }

  removeAllCellListeners() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const element = this.cellElements[r]?.[c];
        if (!element) continue;

        const clone = element.cloneNode(false);
        element.parentNode.replaceChild(clone, element);
      }
    }
  }

  resetBoardFromState() {
    this.clearBoard();
    this.createBoard();
  }

  revealAllMines() {
    const revealedMines = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];

        if (!cell.isFlagged && !cell.isRevealed && cell.isMine) {
          cell.isRevealed = true;
          this.updateCellDisplay(r, c);
          revealedMines.push({ r, c });
        }

        if (cell.isFlagged && !cell.isMine) {
          cell.isWrongFlag = true;
          this.updateCellDisplay(r, c);
        }
      }
    }

    for (const { r, c } of revealedMines) {
      const element = this.cellElements[r][c];
      if (element) {
        element.classList.add("cell--wrong-flag");
        element.setAttribute(
          "aria-label",
          `Cell row ${r + 1}, column ${c + 1}, unmarked mine, detonated.`,
        );
      }
    }
  }

  isFinalMine() {
    return false;
  }

  isWon() {
    return (
      this.gameActive &&
      this.grid.every((row) =>
        row.every((cell) => !cell.isMine || cell.isRevealed),
      )
    );
  }
  checkWin() {
    let revealedSafe = 0;
    let flaggedWrong = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];

        if (cell.isRevealed) {
          revealedSafe++;
        }

        if (cell.isFlagged && !cell.isMine) {
          flaggedWrong++;
        }
      }
    }

    if (
      revealedSafe === this.rows * this.cols - this.mines &&
      flaggedWrong === 0
    ) {
      this.gameOver = true;
      this.gameActive = false;
      this.stopTimer();
      this.showWin();
    }
  }

  isWon() {
    if (!this.gameActive) return false;

    const revealedSafe = this.grid.reduce(
      (count, row) =>
        count +
        row.reduce(
          (rowCount, cell) => count + (cell.isRevealed && !cell.isMine ? 1 : 0),
          0,
        ),
      0,
    );

    const totalSafe = this.rows * this.cols - this.mines;
    return revealedSafe === totalSafe;
  }

  isLost() {
    return !this.gameActive && !this.isWon();
  }

  updateStatus(state) {
    if (!this.statusLine) return;

    this.statusLine.setAttribute("data-state", state);

    if (state === "ready") {
      this.statusLine.innerText = "Ready when you are.";
    } else if (state === "playing") {
      this.statusLine.innerText = "Game in progress";
    } else if (state === "won") {
      this.statusLine.innerText = `Completed in ${this.timerLabel.innerText}`;
    } else if (state === "lost") {
      this.statusLine.innerText = "Game over";
    }
  }

  clearBanners() {
    if (this.winBanner) {
      this.winBanner.classList.add("win-banner-hidden");
      this.winBanner.innerHTML = "";
      this.winBanner.removeAttribute("data-state");
    }
  }

  toggleFlagMode(active) {
    this.flagModeActive = active;
    if (this.flagToggleButton) {
      this.flagToggleButton.setAttribute(
        "data-active",
        active ? "true" : "false",
      );
    }
  }
}

function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds * 100) % 100);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const cc = String(hundredths).padStart(2, "0");

  return `${mm}:${ss}.${cc}`;
}

/* ---------- Initialization ---------- */

const game = new Game("EASY");

const diffButtons = [
  document.getElementById("btn-easy"),
  document.getElementById("btn-medium"),
  document.getElementById("btn-hard"),
].filter(Boolean);

diffButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.id.replace("btn-", "").toUpperCase();
    game.reset(mode);
    syncDifficultyButtons(mode);
  });
});

document.getElementById("restart-button").addEventListener("click", () => {
  game.reset(game.mode);
  syncDifficultyButtons(game.mode);
});

document.getElementById("flag-toggle").addEventListener("click", (e) => {
  const next = !game.flagModeActive;
  game.toggleFlagMode(next);
  e.currentTarget.blur();
});

document.addEventListener("click", (e) => {
  if (game.flagModeActive) {
    const flagButton = document.getElementById("flag-toggle");
    if (!flagButton?.contains(e.target)) {
      game.toggleFlagMode(false);
    }
  }
});

document.addEventListener("pointerup", (e) => {
  if (e.button !== 2) return;

  if (game.flagModeActive && e.target?.closest(".cell")) {
    e.preventDefault();
  }
});

document.addEventListener("contextmenu", (e) => {
  if (!game.gameContainer.contains(e.target)) return;
  e.preventDefault();
});

/* ---------- Settings ---------- */

const settingsButton = document.getElementById("settings-button");
const settingsPopover = document.getElementById("settings-popover");

if (settingsButton && settingsPopover) {
  settingsButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = settingsButton.getAttribute("aria-expanded") !== "true";
    settingsButton.setAttribute("aria-expanded", open ? "true" : "false");
    settingsPopover.hidden = !open;
    settingsPopover.setAttribute("aria-hidden", open ? "false" : "true");
  });

  document.addEventListener("click", (e) => {
    if (
      !settingsPopover.hidden &&
      !settingsButton.contains(e.target) &&
      !settingsPopover.contains(e.target)
    ) {
      settingsButton.setAttribute("aria-expanded", "false");
      settingsPopover.hidden = true;
      settingsPopover.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsPopover.hidden) {
      settingsButton.setAttribute("aria-expanded", "false");
      settingsPopover.hidden = true;
      settingsPopover.setAttribute("aria-hidden", "true");
    }
  });
}

const soundSwitch = document.getElementById("setting-sound");
const motionSwitch = document.getElementById("setting-motion");

if (soundSwitch) {
  soundSwitch.addEventListener("click", () => {
    const next = soundSwitch.getAttribute("data-on") !== "true";
    soundSwitch.setAttribute("data-on", next ? "true" : "false");
    soundSwitch.setAttribute("aria-checked", next ? "true" : "false");
  });
}

if (motionSwitch) {
  motionSwitch.addEventListener("click", () => {
    const next = motionSwitch.getAttribute("data-on") !== "true";
    motionSwitch.setAttribute("data-on", next ? "true" : "false");
    motionSwitch.setAttribute("aria-checked", next ? "true" : "false");

    if (next) {
      document.documentElement.style.setProperty("--motion", "reduce");
      document.documentElement.classList.add("motion-reduced");
    } else {
      document.documentElement.style.removeProperty("--motion");
      document.documentElement.classList.remove("motion-reduced");
    }
  });
}

function syncDifficultyButtons(mode) {
  const target = diffButtons.find(
    (button) => button.id === `btn-${mode.toLowerCase()}`,
  );
  if (!target) return;

  diffButtons.forEach((button) => {
    const isActive = button === target;
    button.setAttribute("data-active", isActive ? "true" : "false");
  });
}
