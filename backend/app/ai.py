import os
import json
from groq import Groq

# Initialize Groq client
# If GROQ_API_KEY is not in the environment, it will fail gracefully when called if we handle it,
# or we can check if it exists before using the client.
api_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

def classify_ticket(title: str, description: str) -> dict:
    """
    Analyzes a ticket and returns a predicted category and priority.
    """
    if not client:
        return _fallback_classify(title, description)

    prompt = f"""
    Analyze the following IT support ticket and determine its Category and Priority.
    Categories allowed: Bug, Feedback, Feature Request, Support
    Priorities allowed: Low, Medium, High, Critical

    Ticket Title: {title}
    Ticket Description: {description}

    Return ONLY a raw JSON object (no markdown formatting, no backticks, no other text) with two keys: "category" and "priority".
    Example: {{"category": "Bug", "priority": "High"}}
    """

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=50
        )
        content = response.choices[0].message.content.strip()
        # Clean up in case model wrapped it in markdown json block
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        parsed = json.loads(content.strip())
        category = parsed.get("category", "Support")
        priority = parsed.get("priority", "Medium")
        
        # Ensure correct casing to match our enum
        category_map = {
            "bug": "Bug",
            "feedback": "Feedback",
            "feature request": "Feature Request",
            "support": "Support"
        }
        category = category_map.get(category.lower(), "Support")
        
        priority_map = {
            "low": "Low",
            "medium": "Medium",
            "high": "High",
            "critical": "Critical"
        }
        priority = priority_map.get(priority.lower(), "Medium")
            
        return {"category": category, "priority": priority}
    except Exception as e:
        print(f"Groq API Error in classification: {e}")
        return _fallback_classify(title, description)

def generate_suggested_reply(ticket_context: dict, chat_history: list) -> str:
    """
    Generates a professional AI reply draft based on the ticket context and chat history.
    """
    if not client:
        return _fallback_reply(ticket_context)

    history_text = "\n".join([f"{msg['author']}: {msg['content']}" for msg in chat_history])
    if not history_text:
        history_text = "No prior messages."

    prompt = f"""
    You are an expert IT support agent helping a customer.
    Write a highly professional, empathetic, and concise reply to the customer's ticket.
    Do not include placeholder names like [Your Name]. Just write the message body directly.

    Ticket Title: {ticket_context.get('title')}
    Ticket Description: {ticket_context.get('description')}
    Ticket Category: {ticket_context.get('category')}
    
    Previous Chat History:
    {history_text}
    
    Write the next reply as the support agent:
    """

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API Error in reply generation: {e}")
        return _fallback_reply(ticket_context)

def _fallback_classify(title: str, description: str) -> dict:
    text = (title + " " + description).lower()
    
    if "bug" in text or "error" in text or "fail" in text or "crash" in text:
        category = "Bug"
    elif "feature" in text or "add" in text or "idea" in text:
        category = "Feature Request"
    elif "feedback" in text or "suggest" in text:
        category = "Feedback"
    else:
        category = "Support"
        
    if "urgent" in text or "critical" in text or "down" in text or "emergency" in text:
        priority = "Critical"
    elif "important" in text or "high" in text or "soon" in text:
        priority = "High"
    elif "low" in text or "minor" in text or "typo" in text:
        priority = "Low"
    else:
        priority = "Medium"
        
    return {"category": category, "priority": priority}

def _fallback_reply(ticket_context: dict) -> str:
    title = ticket_context.get('title', 'this issue')
    return f"Hello,\n\nThank you for reaching out regarding '{title}'. We are currently looking into this and will provide an update shortly.\n\nPlease let us know if you have any additional information that might help us resolve this faster.\n\nBest regards,\nSupport Team"
