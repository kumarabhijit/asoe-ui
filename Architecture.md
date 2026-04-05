# Comprehensive Architecture Proposal: ASOE UI & Core Stack (v2.0 - Board Reviewed)

## Executive Summary
This document outlines the comprehensive technical architecture and phase-wise deployment strategy for the **ASOE (CPG Agentic AI Exception Management System)**. The architecture is designed to support 500 concurrent users, deliver 3-10 second real-time updates, and reliably process complex AI tasks with an 8-minute resolution SLA. 

Following a technical board review, this version incorporates advanced recommendations for network security, AI hardware acceleration, and database indexing strategies.

---

## Architecture Flow & Interactions

```mermaid
graph TD
    subgraph "External/Client Edge"
        UI[Next.js 15 Client]
        FrontDoor[Azure Front Door / CDN]
    end

    subgraph "Azure Virtual Network (Production Fortress)"
        subgraph "Azure Container Apps (ACA Environment)"
            API[FastAPI Web Server\nUvicorn]
            Worker[Async Python Workers\nCelery / ARQ]
            Inference[AI Inference Node\nvLLM / AMX Optimized]
        end

        subgraph "Azure Managed Data Services (Private Endpoints)"
            Redis[(Azure Cache for Redis 7+\nPub/Sub & Task Queue)]
            DB[(Azure DB for PostgreSQL 16\nwith pgvector)]
        end
    end

    UI -->|HTTPS / WebSockets| FrontDoor
    FrontDoor -->|Routed Traffic| API
    
    API -->|Read/Write Relational & Vectors| DB
    API <-->|Pub/Sub for 3-10s UI Updates| Redis
    API -->|Enqueue 8-min SLA Tasks| Redis
    
    Redis -->|Dequeue Task| Worker
    Worker -->|Inference Requests| Inference
    Worker -->|Update Resolution State| DB
    Worker -->|Publish Task Complete| Redis
