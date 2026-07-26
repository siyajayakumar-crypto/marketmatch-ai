"""
Ather — FastAPI Backend
========================
Endpoints:
  GET  /api/health
  POST /api/career-evaluate   → SSE stream
  POST /api/business-evaluate → SSE stream
  POST /api/chat              → SSE stream
"""

import os
import json
import logging
from typing import AsyncGenerator, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from google import genai
from google.genai import types

from prompts import CAREER_SYSTEM_PROMPT, STARTUP_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Primary key check for GOOGLE_API_KEY with GEMINI_API_KEY fallback
_api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=_api_key) if _api_key else None
import google.genai
print("google-genai version:", google.genai.__version__)

app = FastAPI(title="Ather API", version="1.0.0")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://frontend:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request Models ────────────────────────────────────────────

class CareerRequest(BaseModel):
    name: str = Field(default="User")
    major: str = Field(default="")
    year: str = Field(default="")
    subjects: str = Field(default="")
    projects: str = Field(default="")
    certifications: str = Field(default="")
    skills: str = Field(default="")
    goal: str = Field(default="")
    experience: str = Field(default="")
    extra: str = Field(default="")

class StartupRequest(BaseModel):
    name: str = Field(default="Founder")
    idea: str = Field(default="")
    audience: str = Field(default="")
    industry: str = Field(default="")
    budget: str = Field(default="")
    techSkills: str = Field(default="")
    teamSize: str = Field(default="1")
    timeline: str = Field(default="")
    problem: str = Field(default="")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    mode: str = Field(default="career")


# ── SSE Helpers ───────────────────────────────────────────────

def sse_text(text: str) -> str:
    return f"data: {text}\n\n"

def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

def sse_error(msg: str) -> str:
    return f"event: error\ndata: {json.dumps({'message': msg})}\n\n"


FALLBACK_CAREER = {
    "scores": {
        "overall": 60, "technical": 55, "communication": 65,
        "projects": 50, "interview": 60, "label": "Rising Talent",
        "percentile": 45, "marketDemand": "High", "timeToOffer": "10-14 weeks",
    },
    "jobs": [
        {"title": "Junior Software Engineer", "company": "Tech Startup", "match": 65,
         "salary": "$70k-$90k", "growth": "18%", "missing": ["System Design", "Cloud"],
         "demand": "High", "remote": True},
        {"title": "Frontend Engineer", "company": "Mid-size Tech", "match": 58,
         "salary": "$65k-$85k", "growth": "15%", "missing": ["TypeScript", "Testing"],
         "demand": "High", "remote": True},
    ],
    "radar": {
        "labels": ["DSA", "System Design", "Communication", "Projects", "Frameworks", "Cloud", "Testing", "DevOps"],
        "values": [55, 40, 65, 50, 60, 35, 40, 30],
    },
    "roadmap": [
        {"week": 1, "title": "Audit & Foundation", "tasks": ["Audit GitHub, add READMEs", "Start LeetCode Easy — 5/day", "Update LinkedIn headline"]},
        {"week": 4, "title": "DSA Sprint", "tasks": ["Complete 50 LeetCode problems", "Study arrays, hashmaps, trees"]},
        {"week": 8, "title": "Interview Prep", "tasks": ["3 mock interviews on Pramp", "System design practice"]},
        {"week": 12, "title": "Apply & Negotiate", "tasks": ["Apply to 20+ companies", "Negotiate all offers"]},
    ],
    "skillgaps": [
        {"skill": "System Design", "priority": "BLOCKER", "salaryImpact": "+$18k avg",
         "jobsRequiring": "73%", "timeToLearn": "4-6 weeks",
         "resources": ["System Design Interview by Alex Xu", "Gaurav Sen YouTube", "Grokking System Design"]},
        {"skill": "DSA Medium", "priority": "BLOCKER", "salaryImpact": "+$12k avg",
         "jobsRequiring": "89%", "timeToLearn": "6-8 weeks",
         "resources": ["Neetcode 150", "LeetCode", "Cracking the Coding Interview"]},
        {"skill": "Cloud (AWS/GCP)", "priority": "HIGH IMPACT", "salaryImpact": "+$15k avg",
         "jobsRequiring": "61%", "timeToLearn": "3-4 weeks",
         "resources": ["AWS Cloud Practitioner free tier", "A Cloud Guru", "Deploy a project to AWS"]},
    ],
}

FALLBACK_BIZ = {
    "bizscores": {
        "viability": 65, "risk": 50, "funding": 55, "market": 70,
        "execution": 60, "label": "Promising Concept", "verdict": "Proceed with Validation",
        "pmfScore": 50, "moatScore": 38, "teamScore": 65, "timingScore": 72,
    },
    "competitors": [
        {"name": "Existing Player A", "funding": "$20M Series A", "strength": "Brand",
         "weakness": "Expensive", "threat": "High", "opportunity": "Undercut on price"},
        {"name": "Existing Player B", "funding": "Bootstrapped", "strength": "Community",
         "weakness": "No mobile", "threat": "Medium", "opportunity": "Mobile-first UX"},
    ],
    "milestones": {
        "thirty": [
            {"task": "Run 20 customer discovery interviews", "status": "todo", "metric": "3 validated pain points"},
            {"task": "Build landing page, collect 100 emails", "status": "todo", "metric": "100 signups"},
            {"task": "Get 5 people to pre-pay", "status": "todo", "metric": "$500 pre-revenue"},
        ],
        "ninety": [
            {"task": "Launch MVP to waitlist", "status": "todo", "metric": "50 active users"},
            {"task": "Reach $1,000 MRR", "status": "todo", "metric": "10 paying customers"},
            {"task": "Apply to 3 accelerators", "status": "todo", "metric": "1 interview"},
        ],
    },
    "funding": {
        "stage": "Pre-seed", "target": "$250k-$750k",
        "sources": ["Bootstrapping first", "Angel investors", "YC / Techstars", "Industry grants"],
        "runway": "18 months", "burnRate": "$12k/month",
        "keyMilestones": ["$5k MRR before raising", "10 reference customers", "Clear unit economics"],
        "vcFirms": ["First Round Capital", "Hustle Fund", "Precursor Ventures", "Pioneer Fund"],
    },
    "revenuemodel": {
        "model": "SaaS Subscription",
        "pricing": [
            {"tier": "Starter", "price": "$29/mo", "features": ["Core feature", "Up to 5 users", "Email support"]},
            {"tier": "Growth",  "price": "$99/mo", "features": ["All features", "Up to 20 users", "Priority support", "API access"]},
            {"tier": "Enterprise", "price": "$299/mo", "features": ["Unlimited users", "Custom integrations", "Dedicated CSM"]},
        ],
        "projections": {
            "month6":  {"mrr": "$2,500",  "customers": 25},
            "month12": {"mrr": "$12,000", "customers": 120},
            "month24": {"mrr": "$45,000", "customers": 450},
        },
    },
}

# ── Streaming Generators ──────────────────────────────────────

async def stream_career(req: CareerRequest) -> AsyncGenerator[str, None]:
    if not client:
        yield sse_error("GOOGLE_API_KEY not configured")
        yield sse_event("scores",    FALLBACK_CAREER["scores"])
        yield sse_event("jobs",      FALLBACK_CAREER["jobs"])
        yield sse_event("radar",     FALLBACK_CAREER["radar"])
        yield sse_event("roadmap",   FALLBACK_CAREER["roadmap"])
        yield sse_event("skillgaps", FALLBACK_CAREER["skillgaps"])
        yield sse_event("done", {})
        return

    user_msg = f"""Evaluate this profile:
Name: {req.name}
Major/Field: {req.major}
Year/Experience Level: {req.year}
Subjects Studied: {req.subjects}
Projects: {req.projects}
Certifications: {req.certifications}
Technical Skills: {req.skills}
Career Goal: {req.goal}
Work Experience: {req.experience}
Additional Context: {req.extra}

Generate the full Career Intelligence Report following the SSE event format."""

    try:
        response = await client.aio.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=user_msg,
            config=types.GenerateContentConfig(
                system_instruction=CAREER_SYSTEM_PROMPT,
                max_output_tokens=8192,
            )
        )
        
        async for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"
                
        yield sse_event("done", {})
        
    except Exception as e:
        error_msg = str(e).lower()
        if "401" in error_msg or "403" in error_msg or "api key" in error_msg:
            yield sse_error("Authentication failed — check your API key")
        elif "429" in error_msg or "quota" in error_msg:
            yield sse_error("Rate limit reached — please wait and retry")
            yield sse_event("scores",    FALLBACK_CAREER["scores"])
            yield sse_event("jobs",      FALLBACK_CAREER["jobs"])
            yield sse_event("radar",     FALLBACK_CAREER["radar"])
            yield sse_event("roadmap",   FALLBACK_CAREER["roadmap"])
            yield sse_event("skillgaps", FALLBACK_CAREER["skillgaps"])
            yield sse_event("done", {})
        else:
            logger.exception(f"Career stream error: {e}")
            yield sse_error(f"Server error: {str(e)}")
            yield sse_event("done", {})


async def stream_startup(req: StartupRequest) -> AsyncGenerator[str, None]:
    if not client:
        yield sse_error("GOOGLE_API_KEY not configured")
        yield sse_event("bizscores",    FALLBACK_BIZ["bizscores"])
        yield sse_event("competitors",  FALLBACK_BIZ["competitors"])
        yield sse_event("milestones",   FALLBACK_BIZ["milestones"])
        yield sse_event("funding",      FALLBACK_BIZ["funding"])
        yield sse_event("revenuemodel", FALLBACK_BIZ["revenuemodel"])
        yield sse_event("done", {})
        return

    user_msg = f"""Evaluate this startup:
Founder: {req.name}
Business Idea: {req.idea}
Problem Solved: {req.problem}
Target Audience: {req.audience}
Industry: {req.industry}
Budget Available: {req.budget}
Technical Skills: {req.techSkills}
Team Size: {req.teamSize}
Launch Timeline: {req.timeline}

Generate the full Startup Viability Report following the SSE event format."""

    try:
        response = await client.aio.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=user_msg,
            config=types.GenerateContentConfig(
                system_instruction=STARTUP_SYSTEM_PROMPT,
                max_output_tokens=8192,
            )
        )
        
        async for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"
                
        yield sse_event("done", {})
        
    except Exception as e:
        error_msg = str(e).lower()
        if "401" in error_msg or "403" in error_msg or "api key" in error_msg:
            yield sse_error("Authentication failed — check your API key")
        elif "429" in error_msg or "quota" in error_msg:
            yield sse_error("Rate limit reached")
            yield sse_event("bizscores",    FALLBACK_BIZ["bizscores"])
            yield sse_event("competitors",  FALLBACK_BIZ["competitors"])
            yield sse_event("milestones",   FALLBACK_BIZ["milestones"])
            yield sse_event("funding",      FALLBACK_BIZ["funding"])
            yield sse_event("revenuemodel", FALLBACK_BIZ["revenuemodel"])
            yield sse_event("done", {})
        else:
            logger.exception(f"Startup stream error: {e}")
            yield sse_error(f"Server error: {str(e)}")
            yield sse_event("done", {})


async def stream_chat(req: ChatRequest) -> AsyncGenerator[str, None]:
    if not client:
        yield sse_text("I'm currently unavailable — please configure GOOGLE_API_KEY.")
        yield sse_event("done", {})
        return

    system = CHAT_SYSTEM_PROMPT
    if req.mode == "startup":
        system += "\n\nThe user is in Startup Mode — focus on entrepreneurship, validation, and business strategy."

    gemini_messages = []
    for m in req.messages:
        role = "model" if m.role == "assistant" else m.role
        gemini_messages.append({"role": role, "parts": [{"text": m.content}]})

    try:
        response = await client.aio.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=gemini_messages,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1500,
            )
        )
        
        async for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"
                
        yield sse_event("done", {})
        
    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "quota" in error_msg:
            yield sse_text("Rate limit reached. Please wait a moment.")
            yield sse_event("done", {})
        else:
            logger.exception(f"Chat stream error: {e}")
            yield sse_text("An error occurred. Please try again.")
            yield sse_event("done", {})


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ather-api", "api_key_set": bool(_api_key)}


@app.post("/api/career-evaluate")
async def career_evaluate(req: CareerRequest):
    return StreamingResponse(
        stream_career(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/business-evaluate")
async def business_evaluate(req: StartupRequest):
    return StreamingResponse(
        stream_startup(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/chat")
async def chat(req: ChatRequest):
    return StreamingResponse(
        stream_chat(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )