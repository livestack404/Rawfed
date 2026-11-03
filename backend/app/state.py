"""Global application state and event streaming bus for FastAPI and WebSockets.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class TrainingState:
    def __init__(self):
        self.is_running: bool = False
        self.is_paused: bool = False
        self.should_stop: bool = False
        self.step_requested: bool = False
        self.current_round: int = 0
        self.total_rounds: int = 0
        self.current_scenario: str = "clean"
        self.active_config: Optional[Dict] = None
        self.run_history: List[Dict] = []
        self.current_run_events: List[Dict] = []
        self.active_websockets: Set[WebSocket] = set()

    async def connect_ws(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_websockets)}")

    def disconnect_ws(self, websocket: WebSocket):
        self.active_websockets.discard(websocket)
        logger.info(f"WebSocket client disconnected. Active: {len(self.active_websockets)}")

    async def emit_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcasts an event to all connected WebSocket clients and buffers for replay."""
        event_payload = {
            "type": event_type,
            "data": data,
        }
        self.current_run_events.append(event_payload)

        if not self.active_websockets:
            return

        dead_sockets = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(event_payload)
            except Exception:
                dead_sockets.add(ws)

        for dead in dead_sockets:
            self.active_websockets.discard(dead)

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def step(self):
        self.is_paused = True
        self.step_requested = True

    def stop(self):
        self.should_stop = True
        self.is_running = False
        self.is_paused = False
        self.step_requested = False

    def reset(self):
        self.is_running = False
        self.is_paused = False
        self.should_stop = False
        self.step_requested = False
        self.current_round = 0
        self.total_rounds = 0
        self.current_run_events.clear()

training_state = TrainingState()

