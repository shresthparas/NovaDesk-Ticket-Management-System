from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps username -> list of active WebSockets (supports multiple tabs)
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)
        await self.broadcast_online_status()

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            if websocket in self.active_connections[username]:
                self.active_connections[username].remove(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]
                import asyncio
                asyncio.create_task(self.broadcast_online_status())

    async def broadcast(self, message: dict):
        for user_sockets in list(self.active_connections.values()):
            for connection in list(user_sockets):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"WebSocket broadcast error: {e}")

    async def broadcast_online_status(self):
        online_users = list(self.active_connections.keys())
        await self.broadcast({"event": "online_status", "online_users": online_users})

manager = ConnectionManager()

@router.websocket("/ws/tickets")
async def websocket_endpoint(websocket: WebSocket, username: str = "Anonymous"):
    await manager.connect(websocket, username)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("event") == "typing":
                await manager.broadcast({
                    "event": "typing",
                    "ticket_id": data.get("ticket_id"),
                    "username": data.get("username")
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)
