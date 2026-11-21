"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;

/** One shared connection. Auth rides on the HttpOnly cookie (withCredentials). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"], autoConnect: true });
  }
  return socket;
}

/** Reconnect so the server re-reads the auth cookie (after login/logout). */
export function reconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}
