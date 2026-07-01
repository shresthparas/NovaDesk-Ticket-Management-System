<div align="center">
  
# 🎫 AI-Powered Ticket Support Management System
  
**A Production-Grade, Full-Stack Real-Time Support Desk built with FastAPI, React, and WebSockets.**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

</div>

---

## 📖 Overview

The **AI-Powered Ticket Support Management System** is a modern, highly scalable helpdesk solution designed to streamline customer support. Moving beyond simple CRUD functionality, this application leverages **Real-Time WebSockets** for live collaboration and **Artificial Intelligence (LLMs)** to automate ticket categorization and draft responses. 

Designed with a premium "Glassmorphism" UI and robust Role-Based Access Control (RBAC), it provides a secure and seamless experience for End-Users, Support Agents, and Administrators.

---

## ✨ Key Architectural Features

- **🔴 Real-Time WebSockets Engine:** The platform is built around a robust, event-driven WebSocket architecture. Ticket updates, live typing indicators, and agent online/offline statuses are broadcasted and synchronized instantly across all connected clients without HTTP polling overhead.
- **🤖 LLM-Powered Workflows:** Integrates Artificial Intelligence (using advanced LLMs) to automate the triage process. Incoming tickets are auto-categorized based on semantic content, and agents are provided with AI-generated draft responses, drastically reducing Mean Time to Resolution (MTTR).
- **📧 Background Task Processing & Email:** Implements multi-threaded background workers to dispatch asynchronous email notifications for ticket updates and creation, ensuring the main FastAPI event loop remains unblocked and responsive even under high load.
- **📋 Interactive Kanban Board:** Agents manage tickets using a custom-built, React-driven drag-and-drop Kanban interface. State transitions (Open → In Progress → Resolved) are synchronized in real-time with the database.
- **🎨 Premium "Glassmorphism" UI/UX:** Built from scratch using modern CSS techniques (without heavy component libraries). Features dynamic dark mode, smooth micro-animations, glowing gradients, and responsive layouts tailored for both desktop and mobile.

---

## 🛡️ Role-Based Access Control (RBAC) Architecture

Security and separation of concerns are core to the platform. The system uses secure, stateless JWT (JSON Web Token) authentication to isolate three distinct user tiers, each with tailored UI experiences and API route protections:

### 1. End-Users (Customers)
- **Experience:** A clean, intuitive dashboard focused on submitting new issues and tracking status.
- **Capabilities:** Create tickets, add comments to their own tickets, receive email updates, and securely manage their profile credentials. They cannot see other users' tickets or system metrics.

### 2. Support Agents
- **Experience:** A high-density, action-oriented workspace centered around a Kanban board.
- **Capabilities:** Receive auto-assigned tickets, drag-and-drop tickets across status columns, utilize AI to draft responses, and communicate directly with users. Agents have access to all active tickets but cannot manage the underlying user accounts.

### 3. Administrators
- **Experience:** A comprehensive control center and analytics dashboard.
- **Capabilities:** Absolute system control. Admins can promote users to Agents, suspend accounts, view system-wide analytics, and oversee all ticket interactions. 

---

## 🛠️ Tech Stack

**Frontend:**
- React.js
- Vite (Build Tool)
- CSS3 (Vanilla CSS with CSS Variables for Theme Management)
- WebSockets API

**Backend:**
- Python 3
- FastAPI (Asynchronous Web Framework)
- MongoDB & Motor (Async NoSQL Database)
- PyJWT (Authentication)
- Uvicorn (ASGI Server)

---

## 🚀 Live Demo Credentials

Want to explore the application without signing up? Use the following dummy credentials to explore the different Role Dashboards:

### 👑 Administrator Account
- **Portal:** `/staff`
- **Username:** `admin`
- **Password:** `AdminSecure123!`

### 🎧 Support Agent Account
- **Portal:** `/staff`
- **Username:** `agent`
- **Password:** `AgentSecure123!`

### 👤 End-User Account
- **Portal:** `/` (Main Login)
- **Username:** `user_demo`
- **Password:** `UserSecure123!`

---

## 💻 Getting Started (Local Development)

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites
- Node.js (v16+)
- Python (3.10+)
- MongoDB (Local or Atlas Cluster)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ticket-management-system.git
cd ticket-management-system
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```env
MONGO_URI=your_mongodb_connection_string
SECRET_KEY=generate_a_secure_random_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload --port 8090
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```

The application will now be running on `http://localhost:5173`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check [issues page](https://github.com/yourusername/ticket-management-system/issues).

## 📝 License

This project is licensed under the MIT License.
