import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  MessageCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Building2,
  Plus,
  X,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import { useAuth } from "../../../../../context/AuthContext";
import { fetchImage } from "../../../../../utils/helper";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import socket from "../../../../../utils/socket";

const ClientInbox = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Search state for the sidebar
  const [searchQuery, setSearchQuery] = useState("");

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // 1. Fetch Inbox
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

  // 2. Fetch Messages
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

        if (currentConv && currentConv.unreadCountClient > 0) {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === selectedChat._id ? { ...c, unreadCountClient: 0 } : c,
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

  // 3. Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const textToSend = newMessage;
    setNewMessage("");
    setSending(true);

    try {
      const res = await axiosInstance.post(API_PATHS.CHAT.SEND_MESSAGE, {
        conversationId: selectedChat._id,
        text: textToSend,
        receiverId: selectedChat.studio._id,
      });

      setMessages((prev) => [...prev, res.data]);

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

  const handleStartNewChat = async (studioId) => {
    try {
      setShowNewChatModal(false);
      const res = await axiosInstance.post(API_PATHS.CHAT.INITIATE, {
        studioId,
      });
      const newOrExistingConv = res.data;

      const exists = conversations.find((c) => c._id === newOrExistingConv._id);
      if (!exists) {
        setConversations((prev) => [newOrExistingConv, ...prev]);
      }
      setSelectedChat(newOrExistingConv);
    } catch (error) {
      console.error("Failed to initiate chat", error);
      alert("Could not start chat. Please try again.");
    }
  };

  // Filter conversations based on search bar
  const filteredConversations = conversations.filter((conv) =>
    conv.studio?.studioName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    // FIXED: Removed "container mx-auto" and adjusted height to match Admin layout perfectly
    <div className='h-[calc(100vh-64px)] md:h-screen bg-gray-50 flex p-4 md:p-6 gap-4 font-sans'>
      {/* --- LEFT PANEL: INBOX LIST --- */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col w-full md:w-80 lg:w-96 shrink-0 overflow-hidden ${selectedChat ? "hidden md:flex" : "flex"}`}>
        {/* Header & Search */}
        <div className='p-4 border-b border-gray-100 flex flex-col gap-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-bold text-gray-900'>Messages</h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className='p-2 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 transition-colors shadow-sm'
              title='New Chat'>
              <Plus className='w-5 h-5' />
            </button>
          </div>
          {/* FIXED: Added Search Bar to match Admin Layout */}
          <div className='relative'>
            <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
            <input
              type='text'
              placeholder='Search studios...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className='flex-1 overflow-y-auto custom-scrollbar'>
          {loadingInbox ? (
            <div className='flex justify-center flex-col items-center h-full text-gray-400'>
              <LoadingSpinner />
              <p className='text-gray-600 font-medium mt-4'>
                Loading conversations, please wait...
              </p>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <div
                key={conv._id}
                onClick={() => setSelectedChat(conv)}
                className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex gap-3 ${selectedChat?._id === conv._id ? "bg-emerald-50/50 hover:bg-emerald-50/50" : ""}`}>
                <div className='w-12 h-12 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-700 font-bold shrink-0 overflow-hidden'>
                  {conv.studio?.studioPictures?.[0] ? (
                    <img
                      src={fetchImage(conv.studio.studioPictures[0])}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    conv.studio?.studioName?.charAt(0) || "S"
                  )}
                </div>
                <div className='flex-1 min-w-0 flex flex-col justify-center'>
                  <div className='flex justify-between items-baseline mb-0.5'>
                    <h3 className='font-bold text-gray-900 text-sm truncate'>
                      {conv.studio?.studioName}
                    </h3>
                    <span className='text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2'>
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className='text-xs text-gray-500 truncate'>
                    {conv.lastMessage || "Start chatting..."}
                  </p>
                </div>

                {conv.unreadCountClient > 0 && (
                  <div className='flex items-center justify-center self-center shrink-0 w-5 h-5 bg-emerald-500 rounded-full text-[10px] font-bold text-white shadow-sm'>
                    {conv.unreadCountClient}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className='p-8 text-center text-gray-400 flex flex-col items-center'>
              <MessageCircle className='w-10 h-10 mb-3 opacity-20' />
              <p className='text-sm font-medium'>No conversations found.</p>
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
                <button
                  onClick={() => setSelectedChat(null)}
                  className='md:hidden p-1.5 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full'>
                  <ArrowLeft className='w-5 h-5' />
                </button>
                <div className='w-12 h-12 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-700 font-bold shrink-0 overflow-hidden'>
                  {selectedChat.studio?.studioPictures?.[0] ? (
                    <img
                      src={fetchImage(selectedChat.studio.studioPictures[0])}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    selectedChat.studio?.studioName?.charAt(0) || "S"
                  )}
                </div>
                <div>
                  <h3 className='font-bold text-gray-900 text-sm leading-tight'>
                    {selectedChat.studio?.studioName}
                  </h3>
                  <p className='text-[10px] text-gray-500 uppercase tracking-wider font-bold'>
                    Official Studio
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className='flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc] space-y-4 custom-scrollbar'>
              {loadingMessages ? (
                <div className='h-full flex items-center justify-center'>
                  <LoadingSpinner />
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, idx) => {
                  const isClient = msg.sender?._id === user._id;

                  return (
                    <div
                      key={idx}
                      className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[75%] md:max-w-[65%] rounded-2xl p-3.5 shadow-sm relative ${
                          isClient
                            ? "bg-emerald-700 text-white rounded-tr-sm"
                            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                        }`}>
                        <p className='text-sm leading-relaxed'>{msg.text}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 justify-end ${isClient ? "text-emerald-200" : "text-gray-400"}`}>
                          <span className='text-[10px] font-medium'>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isClient && <CheckCircle2 className='w-3 h-3' />}
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
                    Start a conversation with {selectedChat.studio?.studioName}
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
                  className='w-12 h-12 shrink-0 bg-emerald-900 text-white rounded-full flex items-center justify-center hover:bg-emerald-800 disabled:opacity-50 disabled:hover:bg-emerald-900 transition-all shadow-md'>
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
            <h3 className='text-lg font-bold text-gray-900 mb-1'>Your Inbox</h3>
            <p className='text-sm'>
              Select a studio from the left to start chatting.
            </p>
          </div>
        )}
      </div>

      {/* --- NEW CHAT MODAL --- */}
      <AnimatePresence>
        {showNewChatModal && (
          <NewChatModal
            onClose={() => setShowNewChatModal(false)}
            onSelectStudio={handleStartNewChat}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENT: NEW CHAT MODAL ---
const NewChatModal = ({ onClose, onSelectStudio }) => {
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchStudios = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(API_PATHS.STUDIOS.GET_ALL);
        setStudios(res.data);
      } catch (err) {
        console.error("Failed to fetch studios", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudios();
  }, []);

  const filteredStudios = studios.filter((s) =>
    s.studioName?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className='relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden'>
        <div className='p-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0'>
          <h3 className='text-lg font-bold text-gray-900'>Start New Chat</h3>
          <button
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='p-4 border-b border-gray-100 bg-gray-50 shrink-0'>
          <div className='relative'>
            <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
            <input
              type='text'
              placeholder='Search studios...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
            />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-2 custom-scrollbar'>
          {loading ? (
            <div className='flex justify-center p-8'>
              <LoadingSpinner />
            </div>
          ) : filteredStudios.length > 0 ? (
            filteredStudios.map((studio) => (
              <div
                key={studio._id}
                onClick={() => onSelectStudio(studio._id)}
                className='flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors border border-transparent hover:border-emerald-100'>
                <div className='w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 overflow-hidden'>
                  {studio.studioPictures?.[0] ? (
                    <img
                      src={fetchImage(studio.studioPictures[0])}
                      alt='Studio'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <Building2 className='w-5 h-5' />
                  )}
                </div>
                <div>
                  <h4 className='font-bold text-sm text-gray-900 leading-tight'>
                    {studio.studioName}
                  </h4>
                  <p className='text-xs text-gray-500'>
                    {studio.address?.city || "Pilates Studio"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className='p-8 text-center text-gray-400'>
              <p className='text-sm'>No studios found.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ClientInbox;
