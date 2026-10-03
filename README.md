# 🚀 ServerFlow – Server Request Load Distributor

> An intelligent server request routing system that distributes incoming requests using **Priority Queue** and **Greedy Algorithm** techniques.

---

## 📌 Project Overview

**ServerFlow** is a web-based server request load distribution system developed for **DAA Hackathon – Problem Statement 71: Server Request Load Distributor**.

The system simulates incoming client requests and intelligently routes them to suitable servers based on:

- Request Priority
- Server Queue Length
- Server Capacity
- Estimated Response Cost

The project demonstrates how **Data Structures and Algorithms** can be applied to a practical distributed-systems problem.

---

## 🎯 Problem Statement

Modern systems continuously receive requests from multiple clients. If requests are not distributed efficiently, some servers may become overloaded while others remain underutilized.

This can result in:

- Increased waiting time
- Queue buildup
- Uneven server utilization
- Increased response cost
- Poor request handling

The objective of ServerFlow is to simulate an intelligent routing mechanism that selects the appropriate request and server efficiently.

---

## 💡 Our Solution

ServerFlow uses two main algorithms:

### 1. Priority Queue

Incoming requests are stored in a Priority Queue.

The request with the **highest priority is processed first**.

Python's `heapq` module is used to implement the priority queue.

Since Python's `heapq` is a min-heap, priorities are stored as negative values so that higher-priority requests are selected first.

Example:

| Request | Priority |
|--------|----------|
| R1 | 5 |
| R2 | 2 |
| R3 | 9 |
| R4 | 6 |

Processing order:

```text
R3 → R4 → R1 → R2
