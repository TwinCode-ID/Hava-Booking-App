import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import socket from "../utils/socket";
import { AUTH_TOKEN_ROTATED_EVENT } from "../utils/authToken";

const GlobalSocketListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?._id) {
      if (socket.connected) socket.disconnect();
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      if (user.role === "client") {
        socket.emit("join_user_room", user._id);
      } else if (user.role === "studioAdmin") {
        socket.emit("join_studio_admin_room", user.adminStudioLocation);
      }
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on("connect", handleConnect);

    const handleTokenRotation = () => {
      socket.disconnect();
      socket.connect();
    };

    window.addEventListener(AUTH_TOKEN_ROTATED_EVENT, handleTokenRotation);

    socket.on("purchase_notification", (data) => {
      // Triggered by the newly added backend socket
      if (data.type === "PASS_FREEZE_UPDATED") {
        window.dispatchEvent(new Event("pass-freeze-updated"));
      }

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

    return () => {
      socket.off("connect", handleConnect);
      socket.off("purchase_notification");
      window.removeEventListener(
        AUTH_TOKEN_ROTATED_EVENT,
        handleTokenRotation,
      );
      socket.disconnect();
    };
  }, [user]);

  return null;
};

export default GlobalSocketListener;
