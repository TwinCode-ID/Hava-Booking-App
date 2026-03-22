import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  User,
  MessageCircle,
  MoreVertical,
  Loader2,
  Info,
  CheckCircle2,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import { useAuth } from "../../../../../context/AuthContext";
import { fetchImage } from "../../../../../utils/helper";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import socket from "../../../../../utils/socket";

const AdminInbox = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch Inbox (All Conversations)
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoadingInbox(true);
        const res = await axiosInstance.get(API_PATHS.CHAT.GET_CONVERSATIONS);
        setConversations(res.data);
      } catch (error) {
        console.error("Failed to load inbox", error);
      } finally {
        setLoadingInbox(false);
      }
    };
    fetchInbox();
  }, []);

  // 2. Fetch Messages when a chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await axiosInstance.get(
          API_PATHS.CHAT.GET_MESSAGES(selectedChat._id),
        );
        setMessages(res.data);

        const currentConv = conversations.find(
          (c) => c._id === selectedChat._id,
        );

        if (currentConv && currentConv.unreadCountStudio > 0) {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === selectedChat._id ? { ...c, unreadCountStudio: 0 } : c,
            ),
          );
          await axiosInstance.put(API_PATHS.CHAT.MARK_READ(selectedChat._id));
        }
      } catch (error) {
        console.error("Failed to load messages", error);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChat]);

  // 3. Send a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const textToSend = newMessage;
    setNewMessage(""); // Clear input immediately for better UX
    setSending(true);

    try {
      const res = await axiosInstance.post(API_PATHS.CHAT.SEND_MESSAGE, {
        conversationId: selectedChat._id,
        text: textToSend,
        receiverId: selectedChat.client._id,
      });

      // Add the new message to the current chat window
      setMessages((prev) => [...prev, res.data]);

      // Update the preview in the sidebar
      setConversations((prev) =>
        prev
          .map((conv) =>
            conv._id === selectedChat._id
              ? { ...conv, lastMessage: textToSend, lastMessageAt: new Date() }
              : conv,
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
          ),
      );
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!selectedChat) return;
    socket.emit("join_chat", selectedChat._id);

    const handleNewMessage = (incomingMessage) => {
      if (incomingMessage.conversationId === selectedChat._id) {
        if (incomingMessage.sender._id !== user._id) {
          setMessages((prev) => [...prev, incomingMessage]);
        }
      }

      setConversations((prev) =>
        prev
          .map((conv) =>
            conv._id === incomingMessage.conversationId
              ? {
                  ...conv,
                  lastMessage: incomingMessage.text,
                  lastMessageAt: incomingMessage.createdAt,
                }
              : conv,
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
          ),
      );
    };

    socket.on("receive_message", handleNewMessage);
    return () => {
      socket.off("receive_message", handleNewMessage);
    };
  }, [selectedChat, user._id]);

  return (
    <div className='h-[calc(100vh-64px)] md:h-screen bg-gray-50 flex p-4 md:p-6 gap-4 font-sans'>
      {/* --- LEFT PANEL: INBOX LIST --- */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col w-full md:w-80 lg:w-96 shrink-0 overflow-hidden ${selectedChat ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className='p-4 border-b border-gray-100 flex flex-col gap-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-bold text-gray-900'>Messages</h2>
            <div className='p-2 bg-emerald-50 text-emerald-600 rounded-full'>
              <MessageCircle className='w-5 h-5' />
            </div>
          </div>
          <div className='relative'>
            <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
            <input
              type='text'
              placeholder='Search clients...'
              className='w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className='flex-1 overflow-y-auto custom-scrollbar'>
          {loadingInbox ? (
            <div className='flex justify-center items-center h-full text-gray-400'>
              <LoadingSpinner />
            </div>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => (
              <div
                key={conv._id}
                onClick={() => setSelectedChat(conv)}
                className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex gap-3 ${selectedChat?._id === conv._id ? "bg-emerald-50/50 hover:bg-emerald-50/50" : ""}`}>
                {/* Avatar */}
                <div className='w-12 h-12 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-700 font-bold shrink-0 overflow-hidden'>
                  {conv.client?.avatar ? (
                    <img
                      src={fetchImage(conv.client.avatar)}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    conv.client?.fullName?.charAt(0) || "U"
                  )}
                </div>

                {/* Info */}
                <div className='flex-1 min-w-0 flex flex-col justify-center'>
                  <div className='flex justify-between items-baseline mb-0.5'>
                    <h3 className='font-bold text-gray-900 text-sm truncate'>
                      {conv.client?.fullName}
                    </h3>
                    <span className='text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2'>
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className='text-xs text-gray-500 truncate'>
                    {conv.lastMessage || "No messages yet."}
                  </p>
                </div>

                {/* Unread Badge */}
                {conv.unreadCountStudio > 0 && (
                  <div className='flex items-center justify-center self-center shrink-0 w-5 h-5 bg-emerald-500 rounded-full text-[10px] font-bold text-white shadow-sm'>
                    {conv.unreadCountStudio}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className='p-8 text-center text-gray-400 flex flex-col items-center'>
              <MessageCircle className='w-10 h-10 mb-3 opacity-20' />
              <p className='text-sm font-medium'>No conversations yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- RIGHT PANEL: ACTIVE CHAT --- */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden relative ${!selectedChat ? "hidden md:flex" : "flex"}`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className='h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 shadow-sm z-10'>
              <div className='flex items-center gap-3'>
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedChat(null)}
                  className='md:hidden p-1.5 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'>
                    <path d='m15 18-6-6 6-6' />
                  </svg>
                </button>

                <div className='w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden'>
                  {selectedChat.client?.avatar ? (
                    <img
                      src={fetchImage(selectedChat.client.avatar)}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    selectedChat.client?.fullName?.charAt(0) || "U"
                  )}
                </div>
                <div>
                  <h3 className='font-bold text-gray-900 text-sm leading-tight'>
                    {selectedChat.client?.fullName}
                  </h3>
                  <p className='text-[10px] text-gray-500 uppercase tracking-wider font-bold'>
                    Client
                  </p>
                </div>
              </div>
              <button className='p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors'>
                <MoreVertical className='w-5 h-5' />
              </button>
            </div>

            {/* Messages Area */}
            <div className='flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc] space-y-4 custom-scrollbar'>
              {loadingMessages ? (
                <div className='h-full flex items-center justify-center'>
                  <LoadingSpinner />
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, idx) => {
                  const isAdmin = msg.sender?._id === user._id; // Is the sender the logged-in admin?

                  return (
                    <div
                      key={idx}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[75%] md:max-w-[65%] rounded-2xl p-3.5 shadow-sm relative ${
                          isAdmin
                            ? "bg-emerald-700 text-white rounded-tr-sm"
                            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                        }`}>
                        <p className='text-sm leading-relaxed'>{msg.text}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 justify-end ${isAdmin ? "text-emerald-200" : "text-gray-400"}`}>
                          <span className='text-[10px] font-medium'>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isAdmin && <CheckCircle2 className='w-3 h-3' />}
                        </div>
                      </motion.div>
                    </div>
                  );
                })
              ) : (
                <div className='h-full flex flex-col items-center justify-center text-gray-400'>
                  <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3'>
                    <MessageCircle className='w-8 h-8 text-gray-300' />
                  </div>
                  <p className='text-sm font-medium'>
                    Say hello to {selectedChat.client?.fullName}!
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className='p-4 bg-white border-t border-gray-100 shrink-0'>
              <form
                onSubmit={handleSendMessage}
                className='flex items-center gap-3'>
                <input
                  type='text'
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder='Type a message...'
                  className='flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all'
                />
                <button
                  type='submit'
                  disabled={!newMessage.trim() || sending}
                  className='w-12 h-12 shrink-0 bg-emerald-900 text-white rounded-full flex items-center justify-center hover:bg-emerald-800 disabled:opacity-50 disabled:hover:bg-emerald-900 transition-all shadow-md hover:shadow-lg'>
                  {sending ? (
                    <Loader2 className='w-5 h-5 animate-spin' />
                  ) : (
                    <Send className='w-5 h-5 ml-1' />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className='hidden md:flex h-full flex-col items-center justify-center text-gray-400 bg-gray-50/50'>
            <div className='w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4'>
              <MessageCircle className='w-10 h-10 text-emerald-200' />
            </div>
            <h3 className='text-lg font-bold text-gray-900 mb-1'>
              Your Messages
            </h3>
            <p className='text-sm'>
              Select a conversation from the left to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInbox;
