

function sosWebSocket(wss) {
    let childs = {};
    let parents = {};

    wss.on('connection', (ws) => {
        console.log('SOS WebSocket connected');

        ws.on('message', (message) => {
            const data = JSON.parse(message);

            if (data.type === 'register_child') {
                console.log("Child Registered for SOS: " + data.childId);
                childs[data.childId] = { ws, sosStatus: false };

            } else if (data.type === 'register_parent') {
                console.log("Parent Registered for SOS: " + data.parentId, "Children:", data.targetchildId);
                parents[data.parentId] = { ws, targetchildId: data.targetchildId };

            } else if (data.type === 'sos_update') {
                // Handle SOS updates from child
                const { childId, status } = data;
                console.log(`SOS status from ${childId}: ${status}`);

                if (childs[childId]) {
                    childs[childId].sosStatus = status;

                    // Broadcast to all parents watching this child
                    for (let parentId in parents) {
                        const parent = parents[parentId];
                        if  (parent.targetchildId === childId) {
                            parent.ws.send(JSON.stringify({
                                type: 'sos_update',
                                childId: childId,
                                status: status
                            }));
                            console.log("SOS update sent to parent: " + parentId);
                        }
                    }
                }
            }

        });

        ws.on('close', () => {
            console.log('SOS WebSocket disconnected');

            // Remove disconnected sockets
            for (let id in parents) {
                if (parents[id].ws === ws) delete parents[id];
            }
            for (let id in childs) {
                if (childs[id].ws === ws) delete childs[id];
            }
        });
    });
}

module.exports = sosWebSocket;
