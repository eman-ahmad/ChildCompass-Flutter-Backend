function sosWebSocket(wss) {
  let childs = {};
  let parents = {};

  wss.on("connection", (ws) => {
    console.log("SOS WebSocket connected");

    ws.on("message", (message) => {
      const data = JSON.parse(message);

      if (data.type === "register_child") {
        console.log("Child Registered: " + data.childId);

        // Save child socket and initial SOS status
        childs[data.childId] = { ws, sosStatus: "inactive" };

        // ✅ After registering child, notify any parent waiting
        for (const [parentId, parentData] of Object.entries(parents)) {
          if (parentData.targetchildId === data.childId) {
            parentData.ws.send(
              JSON.stringify({
                type: "sos_update",
                childId: data.childId,
                status: childs[data.childId].sosStatus,
              })
            );
            console.log(
              `Notified parent ${parentId} of child ${
                data.childId
              } SOS status: ${childs[data.childId].sosStatus}`
            );
          }
        }
      } else if (data.type === "register_parent") {
        console.log(
          "Parent Registered for SOS: " + data.parentId,
          "Children:",
          data.targetchildId
        );
        parents[data.parentId] = { ws, targetchildId: data.targetchildId };

        // Check if the child is already registered and send the SOS status
        const childId = data.targetchildId;
        if (childs[childId]) {
          const currentStatus = childs[childId].sosStatus;
          ws.send(
            JSON.stringify({
              type: "sos_update",
              childId: childId,
              status: currentStatus,
            })
          );
          console.log("Initial SOS status sent to parent: " + currentStatus);
        } else {
          console.log(`Child ${childId} not registered yet, no status sent.`);
        }
      } else if (data.type === "sos_update") {
        // Handle SOS updates from child
        const { childId, status } = data;
        console.log(`SOS status from ${childId}: ${status}`);

        // FIX: Check if child exists before updating status
        if (!childs[childId]) {
          console.error(`Child ${childId} not registered`);
          return;
        }

        console.log("Updating SOS state to:", status === "active");
        childs[childId].sosStatus = status;
        console.log("State updated successfully");

        // Broadcast to all parents watching this child
        for (let parentId in parents) {
          const parent = parents[parentId];
          console.log("Comparing:", parent.targetchildId, childId);
          if (parent.targetchildId === childId) {
            parent.ws.send(
              JSON.stringify({
                type: "sos_update",
                childId: childId,
                status: status,
              })
            );
            console.log("SOS update sent to parent: " + parentId);
          }
        }
      }
    });

    ws.on("close", () => {
      console.log("SOS WebSocket disconnected");

      // Remove disconnected sockets
      for (let id in parents) {
        if (parents[id].ws === ws) delete parents[id];
      }
      for (let id in childs) {
        if (childs[id].ws === ws) delete childs[id];
      }
    });
  });

  setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // 1 = OPEN
        client.send(JSON.stringify({ type: "ping" }));
      }
    });
  }, 30000);
}

module.exports = sosWebSocket;
