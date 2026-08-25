import { io } from "socket.io-client";
import { getAccessToken } from "./authToken";
import { BASE_URL } from "./apiPath";

const socket = io(BASE_URL, {
  autoConnect: false,
  auth: (callback) => {
    const token = getAccessToken();
    callback(token ? { token } : {});
  },
});

export default socket;
