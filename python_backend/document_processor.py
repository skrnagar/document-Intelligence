from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict
import json
import requests
from datetime import datetime

app = FastAPI()

# In-memory storage for document processing status
processing_status: Dict[int, Dict] = {}

class DocumentRequest(BaseModel):
    document_id: int
    content: str
    metadata: Optional[dict] = None

class ProcessingStatus(BaseModel):
    status: str
    progress: float
    error: Optional[str] = None
    completed_at: Optional[str] = None

def process_document(doc: DocumentRequest):
    """Background task for document processing"""
    try:
        # Initialize status
        processing_status[doc.document_id] = {
            "status": "processing",
            "progress": 0.0
        }

        # Document processing steps
        # 1. Text preprocessing
        processing_status[doc.document_id]["progress"] = 0.3
        
        # 2. Feature extraction
        processing_status[doc.document_id]["progress"] = 0.6
        
        # 3. Embedding generation
        processing_status[doc.document_id]["progress"] = 0.9

        # Mark as complete
        processing_status[doc.document_id].update({
            "status": "completed",
            "progress": 1.0,
            "completed_at": datetime.utcnow().isoformat()
        })

        # Notify NestJS backend about completion
        callback_url = f"http://localhost:5000/api/documents/{doc.document_id}/callback"
        requests.post(callback_url, json={
            "status": "completed",
            "document_id": doc.document_id
        })

    except Exception as e:
        processing_status[doc.document_id].update({
            "status": "error",
            "error": str(e)
        })
        # Notify NestJS backend about error
        requests.post(callback_url, json={
            "status": "error",
            "document_id": doc.document_id,
            "error": str(e)
        })

@app.post("/process")
async def start_processing(doc: DocumentRequest, background_tasks: BackgroundTasks):
    """Start document processing"""
    background_tasks.add_task(process_document, doc)
    return {"message": "Processing started", "document_id": doc.document_id}

@app.get("/status/{document_id}")
async def get_status(document_id: int):
    """Get processing status"""
    if document_id not in processing_status:
        raise HTTPException(status_code=404, detail="Document not found")
    return processing_status[document_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
