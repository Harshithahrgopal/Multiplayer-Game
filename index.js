const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.resolve("")));

let waitingPlayers = [];   // Players waiting to be matched
let activeGames = [];      // All active games

io.on("connection", (socket) => {
  
  // 1. Player clicks "Search for a player"
  socket.on("find", (data) => {
    const { name } = data;
    if (!name) return;

    waitingPlayers.push({ id: socket.id, name });

    // If 2 players are waiting, match them
    if (waitingPlayers.length >= 2) {
      const p1 = waitingPlayers.shift();
      const p2 = waitingPlayers.shift();

      // Create a new game
      const game = {
        p1: { name: p1.name, value: "X", id: p1.id, move: "" },
        p2: { name: p2.name, value: "O", id: p2.id, move: "" },
        sum: 0 // total moves (used for turn order and detecting draws)
      };

      activeGames.push(game);

      // Notify both players about the match
      io.to(p1.id).emit("find", { allPlayers: activeGames });
      io.to(p2.id).emit("find", { allPlayers: activeGames });
    }
  });

  // 2. Player makes a move (X or O)
  socket.on("playing", (data) => {
    // data => { value: "X"/"O", id: "btnX", name: "PlayerName" }
    const game = activeGames.find(
      (g) => g.p1.name === data.name || g.p2.name === data.name
    );
    if (!game) return;

    if (data.value === "X" && game.p1.name === data.name) {
      game.p1.move = data.id;
      game.sum++;
    } else if (data.value === "O" && game.p2.name === data.name) {
      game.p2.move = data.id;
      game.sum++;
    }

    // Broadcast updated game to everyone
    io.emit("playing", { allPlayers: activeGames });
  });

  // 3. Game is over (someone won or it's a draw)
  socket.on("GameOver", (data) => {
    // data => { name, result: "X WON!!" or "DRAW!!" etc. }
    const { name, result } = data;

    const game = activeGames.find(
      (g) => g.p1.name === name || g.p2.name === name
    );
    if (!game) return;

    // Remove the finished game
    activeGames = activeGames.filter(
      (g) => g.p1.name !== name && g.p2.name !== name
    );

    // Broadcast final result to both players
    io.to(game.p1.id).emit("GameOver", { result });
    io.to(game.p2.id).emit("GameOver", { result });

    console.log(`GameOver for: ${name} => ${result}`);
    console.log("Remaining Games:", activeGames);
  });
});

// Serve index.html at the root
app.get("/", (req, res) => {
  res.sendFile("index.html");
});

// Start on port 3001 (change if needed)
server.listen(3012, () => {
  console.log("Server running on port 3012");
});
