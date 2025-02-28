![image](https://github.com/user-attachments/assets/5b60f6a0-f606-4a3a-bedd-af987c2340bd)

# AI-Powered Document Management Platform

An advanced document management platform that leverages microservices architecture for intelligent document processing, collaborative editing, and multilingual interactions.

## 🌟 Features

- 📄 Intelligent Document Processing
- 🤖 AI-Powered Document Analysis
- 🔍 Advanced Search & Retrieval
- 👥 Real-time Collaboration
- 🔐 Role-based Access Control
- 🌐 Multilingual Support

## 🏗️ Architecture

The application uses a modern microservices architecture:

```
├── Frontend (Angular)
├── API Gateway (NestJS)
├── Document Processing Service (FastAPI)
├── Authentication Service
├── Database Layer
│   ├── PostgreSQL (Document Metadata)
│   └── Vector Database (Document Embeddings)
└── AI Services Integration
```

## 🛠️ Tech Stack

- **Frontend**: Angular with ShadcnUI components
- **Backend**: 
  - NestJS for API Gateway
  - FastAPI for Python-based Document Processing
- **Database**: 
  - PostgreSQL for structured data
  - Vector database for embeddings
- **AI/ML**: 
  - OpenAI GPT-4 for text analysis
  - Hugging Face transformers
- **Real-time**: WebSocket for live collaboration

## 📸 Screenshots

### Document Management
![Document Management](screenshots/document-management.png)
*Upload and manage your documents with intelligent categorization*

### AI-Powered Analysis
![AI Analysis](screenshots/ai-analysis.png)
*Get intelligent insights and summaries from your documents*

### Search Interface
![Search Interface](screenshots/search-interface.png)
*Advanced search capabilities with semantic understanding*

### Collaboration Features
![Collaboration](screenshots/collaboration.png)
*Real-time collaborative editing and annotations*

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or later)
- Python 3.11 or later
- PostgreSQL database

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=development

# Python Backend Configuration
PYTHON_BACKEND_PORT=5001
PYTHON_BACKEND_HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here

# Session Configuration
SESSION_SECRET=your-session-secret-here
```

### Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the development server:
```bash
npm run dev
```

4. Start the Python backend:
```bash
cd python_backend
./start.sh
```

## 📚 API Documentation

### Document Management

- `POST /api/documents`: Upload a new document
- `GET /api/documents`: List all documents
- `GET /api/documents/:id`: Get document details
- `DELETE /api/documents/:id`: Delete a document

### AI Analysis

- `POST /api/qa`: Ask questions about documents
- `POST /api/summarize`: Generate document summaries
- `POST /api/analyze`: Perform document analysis

### Authentication

- `POST /api/register`: Register a new user
- `POST /api/login`: Login user
- `POST /api/logout`: Logout user
- `GET /api/user`: Get current user info

## 🔒 Security

- JWT-based authentication
- Role-based access control
- Secure file handling
- Input validation and sanitization
- Rate limiting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
