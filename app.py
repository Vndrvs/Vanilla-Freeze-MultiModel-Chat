from flask import Flask, request, jsonify, render_template, Response
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from langchain_openai import ChatOpenAI
from langchain_deepseek import ChatDeepSeek
from langchain_anthropic import ChatAnthropic
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory

load_dotenv()
app = Flask(__name__)

@app.route('/')
def home():
    return render_template('home-page.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/new-chat')
def new_chat():
    return render_template('index.html')

@app.route('/load-chat')
def load_chat():
    return render_template('load-chat.html')

db_path = "sqlite:///db.sqlite.db"
engine = create_engine(db_path)

Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Text)
    message = Column(Text)
    role = Column(Text)

class MessageStore(Base):
    __tablename__ = "message_store"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Text)
    message = Column(Text)

# flask creates the sqlite dbase with the 3 given tables
Base.metadata.create_all(engine)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

# currently, chatgpt is set as the base model, in a later update,
# I will implement a model-switch toggle on the UI, which will set the model according to the user's preference
llm1 = ChatDeepSeek(
    model="deepseek-chat",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

llm2 = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

llm3 = ChatAnthropic(
    model="claude-3-5-sonnet-20240620",
    temperature=0,
    max_tokens=1024,
    timeout=None,
    max_retries=2,
)

human_template = "{question}"
prompt_template = ChatPromptTemplate.from_messages([
    MessagesPlaceholder(variable_name="history"),
    ("human", human_template),
])

chain = prompt_template | llm2

chain_with_history = RunnableWithMessageHistory(
    chain,
    lambda session_id: SQLChatMessageHistory(session_id=session_id, connection=engine),
    input_messages_key="question",
    history_messages_key="history",
)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_question = data.get("message", "").strip()
    session_id = data.get("session_id")

    if not session_id or not user_question:
        return jsonify({"error": "No session id / No message"}), 400

    session = SessionLocal()

    def generate():
        full_response = ""
        has_content = False

        for chunk in chain_with_history.stream(
            {"question": user_question},
            config={"configurable": {"session_id": session_id}}
        ):
            content = chunk.content
            if content:
                has_content = True
                yield content
            full_response += content

        if not has_content:
            yield "No response from bot."

        user_message = ChatMessage(
            session_id=session_id,
            message=user_question.strip(),
            role="human"
        )
        session.add(user_message)

        ai_message = ChatMessage(
            session_id=session_id,
            message=full_response.strip(),
            role="ai"
        )
        session.add(ai_message)

        session.commit()
        session.close()

        return full_response

    response = Response(generate(), content_type="text/event-stream")

    return response

# this function auto-generates a session id for a given conversation name
def generateSessionId(chatName):
    
    session = SessionLocal()

    try:
        conversation_count = session.query(Conversation).count()

        if conversation_count >= 20:
            return None  

        existing_ids = [row.id for row in session.query(Conversation.id).order_by(Conversation.id).all()]
        # if no conversations are found in the table, it auto sets 1 as the id
        if not existing_ids:  
            new_id = 1
        else:
            # if there are records present, it finds the smallest available one
            for i in range(1, 21):
                if i not in existing_ids:
                    new_id = i
                    break
            else:
                new_id = max(existing_ids) + 1
        # sets the conversation record with id and name in sqlite
        new_convo = Conversation(id=new_id, name=chatName)
        session.add(new_convo)
        session.commit()

        return new_id

    finally:
        session.close()

@app.route("/chat-title", methods=["POST"])
def fetch_name():
    data = request.json
    chatName = data.get("chatName", "").strip()
    print(f"Received chat name: {chatName}") 

    if not chatName:
        return jsonify({"error": "Chat name cannot be empty"}), 400

    session_id = generateSessionId(chatName)

    if not session_id:
        return jsonify({"error": "Session ID generation failed"}), 500

    return jsonify({"session_id": session_id})


@app.route('/get-chats', methods=['GET'])
def get_chats():
    session = SessionLocal()
    try:
        conversations = session.query(Conversation.id, Conversation.name).all()
        session.close()
        return jsonify([{"id": chat[0], "name": chat[1]} for chat in conversations])
    except Exception as e:
        session.close()
        return jsonify({"error": str(e)}), 500

@app.route("/fetch-messages", methods=["GET"])
def fetch_messages():
    session_id = request.args.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = SessionLocal()

    try:
        messages = session.query(ChatMessage).filter_by(session_id=session_id).order_by(ChatMessage.id).all()

        message_list = [
            {"role": msg.role, "content": msg.message}
            for msg in messages
        ]

        return jsonify(message_list)
    finally:
        session.close()

@app.route('/delete-chat/<int:chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    session = SessionLocal()
    try:
        session.query(MessageStore).filter_by(session_id=chat_id).delete()
        session.query(ChatMessage).filter_by(session_id=chat_id).delete()

        deleted_rows = session.query(Conversation).filter_by(id=chat_id).delete()

        if deleted_rows == 0:
            return jsonify({"error": "Chat not found"}), 404

        session.commit()

        return jsonify({"message": "Chat and related data deleted successfully", "chat_id": chat_id})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
        
if __name__ == "__main__":
    app.run(debug=True)