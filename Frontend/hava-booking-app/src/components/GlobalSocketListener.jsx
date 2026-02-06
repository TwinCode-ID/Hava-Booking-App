import React, { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext"; // Adjust path to your AuthContext
import { io } from "socket.io-client";

const GlobalSocketListener = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Check if user is logged in
    if (!user?._id) return;

    // 2. Define URL
    const rawUrl = import.meta.env.VITE_BASE_URL || "http://localhost:8000";
    const socketUrl = new URL(rawUrl).origin;

    // 3. Connect (Singleton pattern)
    if (!socketRef.current) {
      console.log("🌍 [GLOBAL SOCKET] Connecting...");

      socketRef.current = io(socketUrl, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
      });

      // Join Room
      socketRef.current.on("connect", () => {
        if (user.role === "client") {
          socketRef.current.emit("join_user_room", user._id);
          console.log(
            `🌍 [GLOBAL SOCKET] Connected. Joining room: ${user._id}`,
          );
        } else if (user.role === "studioAdmin") {
          socketRef.current.emit(
            "join_studio_admin_room",
            user.adminStudioLocation,
          );
          console.log(
            `🌍 [GLOBAL SOCKET] Connected. Joining room: ${user.adminStudioLocation}`,
          );
        }
      });

      // Listen for Notifications
      socketRef.current.on("purchase_notification", (data) => {
        console.log("🔔 [GLOBAL SOCKET] Notification:", data);

        if (data.role === "client") {
          if (data.type === "PAYMENT_APPROVED") {
            window.dispatchEvent(new Event("credits-updated"));
          } else if (data.type === "PAYMENT_REJECTED") {
            window.dispatchEvent(new Event("payment-rejected"));
          }
        } else if (data.role === "admin") {
          if (data.type === "NEW_PURCHASE") {
            window.dispatchEvent(new Event("admin-data-updated"));
          } else if (data.type === "PROOF_UPLOADED") {
            window.dispatchEvent(new Event("proof-data-updated"));
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?._id]);

  return null; // This component renders nothing visible
};

export default GlobalSocketListener;
