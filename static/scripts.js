// sidebar toggle on click
document.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.getElementById("toggle-button");
    const sidebar = document.getElementById("sidebar");

    if (!toggleButton || !sidebar) {
        console.error("Sidebar or button not found");
        return;
    }

    toggleButton.addEventListener("click", () => {
        sidebar.classList.toggle("close");
        toggleButton.classList.toggle("rotate");
    });
});

// sidebar texts animation on toggle
document.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.getElementById("toggle-button");
    const sidebarTexts = document.querySelectorAll(".sidebar-text");
    const persistentDivs = document.querySelectorAll(".persistent-text")
    const chatList = document.getElementById("chat-list");

    if (!toggleButton || sidebarTexts.length === 0) {
        console.error("Sidebar text or button not found.");
        return;
    }

    toggleButton.addEventListener("click", () => {
        sidebarTexts.forEach(sidebar => {
            sidebar.classList.toggle("close");
        });
        persistentDivs.forEach(persistentDivs => {
            persistentDivs.classList.toggle("close");
        });
        chatList.classList.toggle("close");
    });
});

// popup, conversation naming
let sessionId = null;

document.addEventListener("DOMContentLoaded", function () {
    let popup = document.querySelector("#popup");
    let overlay = popup.querySelector(".overlay");
    let submitButton = popup.querySelector(".submit-button");
    let chatNameInput = popup.querySelector("#chat-name");
    let messageArea = popup.querySelector(".message-area");
    let newChatButton = document.getElementById("new-chat-button");

    chatNameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    });

    function openPopup() {
        popup.style.display = "flex";
        setTimeout(() => {
            popup.classList.add("active");
        }, 10);
    }

    function closePopup() {
        popup.classList.remove("active");
        chatNameInput.value = "";
        setTimeout(() => {
            popup.style.display = "none"; 
        }, 300);
    }

    async function handleSubmit() {
        let chatName = chatNameInput.value.trim();

        messageArea.innerHTML = "";

        if (chatName === "") {
            messageArea.innerHTML = "<h3 style='color: red; text-align: center;'>Please enter a valid name.</h3>";
            return;
        }

        try {
            const response = await fetch("/chat-title", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatName }),
            });

            if (!response.ok) {
                messageArea.innerHTML = "<h3 style='color: red; text-align: center;'>Unable to create the session.</h3>";
                return;
            }

            const data = await response.json();
            sessionId = data.session_id;
            localStorage.setItem("sessionId", sessionId);

            closePopup();
            loadChatMessages(sessionId);
            addChatToSidebar(chatName, sessionId);
        } catch (error) {
            console.error("Error:", error);
            messageArea.innerHTML = "<h3 style='color: red; text-align: center;'>Server communication error.</h3>";
        }
    }

    async function newChatPopup() {
        localStorage.removeItem("sessionId");
        openPopup();
        submitButton.addEventListener("click", handleSubmit);
    }

    chatNameInput.addEventListener("input", function () {
        messageArea.innerHTML = ""; 
    });

    let sessionId = localStorage.getItem("sessionId");
    console.log("Session ID from localStorage:", sessionId);

    if (!sessionId) {
        console.log("No session ID found, opening popup");
        openPopup();
    } else {
        console.log("found session id, loading chat");
        loadChatMessages(sessionId).catch(error => {
            console.error("Lading messages failed.", error);
            console.log("Error ---> Opening Popup");
            openPopup();
        });
    }
    submitButton.addEventListener("click", handleSubmit);
    overlay.addEventListener("click", handleSubmit);
    if (newChatButton) {
        newChatButton.addEventListener("click", function (event) {
            newChatPopup();
        });
    }
});

async function clearActiveSessionId() {
    localStorage.removeItem("sessionId");
}

// auto-resizes userinput field and its wrapper in chat
function autoResize() {
    const messageInput = document.getElementById("messageInput");
    const userInput = document.getElementById("user-input");

    messageInput.style.height = "auto";
    let newHeight = Math.min(messageInput.scrollHeight, 200);

    messageInput.style.height = newHeight + "px";
}

// handles shift+enter new line break inside user input
function handleKeyPressMessage(event) {
    const messageInput = document.getElementById("message");

    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const session_id = localStorage.getItem("sessionId");
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value.trim();
    const chatbox = document.getElementById("chatbox");
    if (!message) return;

    console.log("Sending message:", { session_id, message: message });

    const userBubble = document.createElement("div");
    userBubble.className = "message user-message";
    userBubble.innerHTML = `<strong>You:</strong> ${message}`;
    chatbox.appendChild(userBubble);

    messageInput.value = "";
    chatbox.scrollTop = chatbox.scrollHeight;

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                session_id: session_id
            })
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botResponse = "";
        let reasoningContent = "";
        let insideCodeBlock = false;
        let currentCodeLanguage = "";

        const botBubble = document.createElement("div");
        botBubble.className = "message bot-message";
        botBubble.innerHTML = "<strong>Bot:</strong> ";
        chatbox.appendChild(botBubble);


        /* Reasoning Bubble / currently commented out, as this will be a function related to the model-switch function

        const reasoningBubble = document.createElement("div");
        reasoningBubble.className = "message reasoning-message";
        reasoningBubble.innerHTML = "<strong>Reasoning:</strong> ";
        chatbox.appendChild(reasoningBubble);
        */
        async function read() {
            let done = false;
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                if (value) {
                    let chunk = decoder.decode(value, { stream: true });

                    if (chunk.includes("```")) {
                        if (!insideCodeBlock) {
                            insideCodeBlock = true;
                            currentCodeLanguage = chunk.match(/```(\w+)?/)?.[1] || "";
                            botResponse += `<pre><code class="${currentCodeLanguage}">`;
                            chunk = chunk.replace(/```(\w+)?/, "");
                        } else {
                            insideCodeBlock = false;
                            botResponse += `</code></pre>`;
                            chunk = chunk.replace("```", "");
                        }
                    }
                    if (chunk.includes("<b>Reasoning:</b>")) {
                        reasoningContent += chunk.replace("<b>Reasoning:</b>", "").trim() + " ";
                        reasoningBubble.innerHTML = `<strong>Reasoning:</strong> ${reasoningContent}`;
                    } else {
                        botResponse += insideCodeBlock ? chunk : chunk.trim() + " ";
                        botBubble.innerHTML = `<strong>Bot:</strong> ${botResponse}`;
                    }

                    chatbox.scrollTop = chatbox.scrollHeight;
                }
                done = streamDone;
            }
        }
        await read();
    } catch (error) {
        console.error("Error:", error);

        const errorBubble = document.createElement("div");
        errorBubble.className = "message error-message";
        errorBubble.innerHTML = `<strong>Error:</strong> Failed to connect to Vanilla Freeze.`;
        chatbox.appendChild(errorBubble);

        chatbox.scrollTop = chatbox.scrollHeight;
    }
}

// save and load conversations

async function updateChatSidebar() {
    let chatList = document.getElementById("chat-list");

    try {
        const response = await fetch("/get-chats");
        const chats = await response.json();

        console.log("Chats fetched from server:", chats);

        chatList.innerHTML = "";

        chats.forEach(chat => {
            const chatName = chat.name;
            const chatId = chat.id;
            console.log("Adding chat:", chatName, "with ID:", chatId);
            addChatToSidebar(chatName, chatId);
        });
    } catch (error) {
        console.error("Error fetching chat names:", error);
    }
}

// adds conversation to the sidebar element
function addChatToSidebar(chatName, chatId) {
    let chatList = document.getElementById("chat-list");
    let li = document.createElement("li");
    let a = document.createElement("a");
    let deleteButton = document.createElement("button");

    deleteButton.classList.add("delete-button");
    deleteButton.innerHTML = `
        <img src="/static/images/bin-xmark-svgrepo-com.svg">`;
    deleteButton.addEventListener("click", () => {
        deleteChat(chatId);
    });
    a.classList.add("sidebar-text");
    a.href = "#";  
    a.innerHTML = `<span>${chatName}</span>`;
    li.setAttribute("data-session-id", chatId);
    li.appendChild(a);
    li.appendChild(deleteButton);
    chatList.appendChild(li);
}

document.addEventListener("DOMContentLoaded", function() {
    updateChatSidebar();
});

let activeSessionId = null;

// loads queried messages related to the specific session and display them in the chatbox
async function loadChatMessages(sessionId) {
    const chatBox = document.getElementById("chatbox");

    try {
        console.log("Fetching messages for session ID:", sessionId);
        const response = await fetch(`/fetch-messages?session_id=${sessionId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch messages");
        }

        const messages = await response.json();
        console.log("Messages fetched:", messages);

        chatBox.innerHTML = "";

        messages.forEach(msg => {
            const content = msg.content?.trim();
            const role = msg.role;

            if (!content) return;

            if (role === "human") {
                const loadedUserBubble = document.createElement("div");
                loadedUserBubble.className = "message user-message";
                loadedUserBubble.innerHTML = `<strong>You:</strong> ${content}`;
                chatBox.appendChild(loadedUserBubble);
            } else {
                const loadedBotBubble = document.createElement("div");
                loadedBotBubble.className = "message bot-message";
                loadedBotBubble.innerHTML = `<strong>Bot:</strong> ${content}`;
                chatBox.appendChild(loadedBotBubble);
            }
        });

        activeSessionId = sessionId;
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch (error) {
        console.error("Error loading chat:", error);

        const errorBubble = document.createElement("div");
        errorBubble.className = "message error-message";
        errorBubble.innerHTML = `<strong>Error:</strong> Failed to load messages.`;
        chatBox.appendChild(errorBubble);

        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// updates the session ID in the local storage, which currently handles session management
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("chat-list").addEventListener("click", (event) => {
        const chatItem = event.target.closest("li");
        if (!chatItem) return;

        const sessionId = chatItem.getAttribute("data-session-id");
        if (!sessionId) {
            console.error("No session ID found for selected chat.");
            return;
        }

        localStorage.setItem("sessionId", sessionId);
        console.log("Updated localStorage with sessionId:", sessionId);

        document.getElementById("chatbox").innerHTML = "";
        loadChatMessages(sessionId);
    });
});

// deletes conversation div from sidebar element
function removeChatFromSidebar(chatId) {
    let chatList = document.getElementById("chat-list");
    let chatItems = chatList.getElementsByTagName("li");

    for (let item of chatItems) {
        let chatNameElement = item.querySelector("a span");

        if (chatNameElement) {
            item.remove();
            break;
        }
    }
}
// handles the flask route that handles the removal of the records
// related to the deleted conversation, including conversation table and message table records
async function deleteChat(chatId) {

    const chatBox = document.getElementById("chatbox");
    try {
        console.log("Deleting chat with ID:", chatId);
        const response = await fetch(`/delete-chat/${chatId}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to delete chat");
        }

        const result = await response.json();
        console.log("Chat deleted:", result);

        const activeSessionId = localStorage.getItem("sessionId");
        if (activeSessionId === chatId.toString()) {
            localStorage.removeItem("sessionId");
            sessionId = null;
        }
        chatBox.innerHTML = "";
        removeChatFromSidebar(chatId);
    } catch (error) {
        console.error("Error deleting cha    t:", error);
    }
}