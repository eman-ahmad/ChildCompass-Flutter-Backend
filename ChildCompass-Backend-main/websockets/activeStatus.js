
function activeStatusWebSocket(wss) {
   

    let childs = {};  // { childId: { ws, lastPing, isOnline } }
    let parents = {}; // { parentId: { ws, targetchildId: [] } }

    // Periodically check ping timeouts
    setInterval(() => {
        const now = Date.now();
        for (let childId in childs) {
            const child = childs[childId];
            if (child.isOnline && now - child.lastPing > 8000) {
                child.isOnline = false;
                notifyAllParentsAbout(childId);
            }
        }
    }, 1000);

    function notifyAllParentsAbout(changedChildId) {
        console.log("Notifying Parent");
        for (let parentId in parents) {
            const { ws, targetchildId } = parents[parentId];

            if (targetchildId.includes(changedChildId)) {
                const statusMap = {};
                targetchildId.forEach(childId => {
                    statusMap[childId] = childs[childId]?.isOnline || false;
                });

                ws.send(JSON.stringify({
                    type: 'status_update',
                    children: statusMap
                }));
            }
        }
    }

    wss.on('connection', (ws) => {
        console.log('Active Status WebSocket connected');

        let registeredChildId = null;
        let registeredParentId = null;

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.log('Invalid JSON:', message);
                return;
            }

            if (data.type === 'register_child') {
                console.log("Child Registered for Active Status:", data.childId);
                childs[data.childId] = { ws, lastPing: Date.now(), isOnline: true };
                registeredChildId = data.childId;
                notifyAllParentsAbout(data.childId);
            }

            else if (data.type === 'ping') {
                if (childs[data.childId]) {
                    childs[data.childId].lastPing = Date.now();

                    if (!childs[data.childId].isOnline) {
                        childs[data.childId].isOnline = true;
                        notifyAllParentsAbout(data.childId);
                    }
                }
            }

            else if (data.type === 'register_parent') {
                console.log("Parent Registered:", data.parentId);
                parents[data.parentId] = { ws, targetchildId: data.targetchildId };
                registeredParentId = data.parentId;

                // Send initial full status of all requested children
                const statusMap = {};
                data.targetchildId.forEach(childId => {
                    statusMap[childId] = childs[childId]?.isOnline || false;
                });

                ws.send(JSON.stringify({
                    type: 'status_update',
                    children: statusMap
                }));
            }
        });

        ws.on('close', () => {
            console.log('ActiveStatus WebSocket disconnected');

            if (registeredChildId) {
                if (childs[registeredChildId]) {
                    childs[registeredChildId].isOnline = false;
                    notifyAllParentsAbout(registeredChildId);
                    delete childs[registeredChildId];
                }
            }

            if (registeredParentId) {
                delete parents[registeredParentId];
            }
        });
    });
}

module.exports = activeStatusWebSocket;
