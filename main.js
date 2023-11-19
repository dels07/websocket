const sockets = [];
const bids = [];
let currentBid = 5_000_000;

function broadcast(message) {
  for (const socket of sockets) {
    socket.send(message);
  }
}

function removeSocket(socket) {
  const index = sockets.indexOf(socket);

  if (index !== -1) {
    sockets.splice(index, 1);
    console.log("DISCONNECTED");
  }
}

function startBid() {
  broadcast(
    JSON.stringify({ type: "bidding_start", user: "admin", bid: currentBid }),
  );
  console.log(`BID START`);

  setTimeout(() => {
    const winner = bids.slice(-1)[0];

    broadcast(JSON.stringify({ ...winner, type: "bidding_end" }));

    for (const socket of sockets) {
      removeSocket(socket);
    }

    console.log(`BID END`);
  }, 61 * 1000);
}

function placeBid(event) {
  const message = JSON.parse(event.data);
  currentBid = currentBid + message.bid;

  if (message.type == "place_bid") {
    const placeBid = { ...message, bid: currentBid };

    bids.push(placeBid);
    broadcast(JSON.stringify(placeBid));
  }

  console.log(`RECEIVED: ${event.data}`);
}

const ac = new AbortController();
const server = Deno.serve({
  port: 80,
  handler: async (request) => {
    if (request.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(request);

      socket.onopen = () => sockets.push(socket);
      socket.onmessage = (event) => placeBid(event);
      socket.onclose = () => removeSocket(socket);
      socket.onerror = (error) => console.error("ERROR:", error);

      return response;
    } else if (request.url.search("/start") !== -1) {
      startBid();

      return new Response("Bidding started", { status: 200 });
    } else {
      const file = await Deno.open("./index.html", { read: true });

      return new Response(file.readable);
    }
  },
  onListen: () => {
    console.log("Listening on http://localhost:80");
  },
  onError: (error) => {
    console.error("ERROR:", error);
  },
});

server.finished.then(() => console.log("Server closed"));
ac.abort();
