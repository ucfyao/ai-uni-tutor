# 🚀 AI Uni Tutor 🎓  
### The AI Copilot for University Learning at Scale

> **AI Uni Tutor** is an AI-powered academic copilot designed to help university students *learn better, not cheat faster*.  
> It combines **LLM reasoning**, **course-specific RAG**, and **pedagogy-aligned tutoring modes** to deliver personalized, ethical, and scalable education support.

<div align="center">

<img src="public/assets/logo.png" alt="AI Uni Tutor Logo" width="150" style="border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Mantine](https://img.shields.io/badge/Mantine-8.0-339AF0?style=flat-square&logo=mantine&logoColor=white)](https://mantine.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Vector-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google-Gemini_Pro-8E75B2?style=flat-square&logo=googlebard&logoColor=white)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[**Quick Start**](#-getting-started) · [**Key Features**](#-key-features) · [**Configuration**](#-configuration)

[🇨🇳 简体中文 (Chinese)](docs/README_zh.md) · [🇺🇸 English](README.md)

</div>

<div align="center">

🧠 **Specialized Tutoring Modes** &nbsp;•&nbsp; 📚 **Context-Aware RAG**<br>
💎 **Pro Max UI/UX** &nbsp;•&nbsp; ⚡ **Real-time Streaming**

</div>

---

### What AI Uni Tutor Is
- A **course-aware AI tutor**
- A **learning companion**, not an answer engine
- A **platform**, not a single model wrapper

### Who It’s For
- 🎓 University students (STEM-first, expanding later)
- 🧑‍🏫 Educators & teaching teams
- 🏫 Institutions exploring AI-assisted learning

---

## 💎 Key Features

### 🧠 Pedagogy-Aligned Tutoring Modes
Each interaction is explicitly scoped to a **learning intent**:
- **Lecture Helper**  
  → Explains concepts using analogies, step-by-step reasoning, and Socratic questioning
- **Assignment Coach**  
  → Guides thinking, debugging, and structure **without revealing final answers**
- **Exam Prep**  
  → Generates exam-style questions, identifies weak spots, and simulates test conditions
> 🔒 Designed to **reduce cheating incentives**, not amplify them.

### 📚 Context-Aware RAG
• **Course Retrieval**: Upload textbooks, slides, and papers. The AI retrieves and grounds every answer in your specific course material using **Supabase Vector Search**.<br>
• **Citation Tracking**: Responses are backed by source documents to ensure academic accuracy.

### 💎 "Pro Max" UI/UX
• **Modern Aesthetic**: Clean, glassmorphic interfaces with deep diffused shadows and unified **Indigo-Violet** gradients.<br>
• **Fluid Interactions**: Levitating cards, magnetic buttons, and smooth layout transitions powered by Mantine v8.

---

## 🚀 Getting Started

### Prerequisites

*   **Node.js**: v18+
*   **Supabase Project**: With `vector` extension enabled.
*   **Google AI Studio Key**: For accessing Gemini Pro model.

### 📦 Installation

**1. Clone Repository**

```bash
git clone https://github.com/yourusername/ai-uni-tutor.git
cd ai-uni-tutor
```

**2. Install Dependencies**

```bash
npm install
```

**3. Configure Environment Variables**

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

<details>
<summary>📋 <b>Environment Variables Reference</b></summary>

| Variable | Required | Description |
|:---|:---:|:---|
| `GEMINI_API_KEY` | **Yes** | Your Google Gemini API Key |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase Anon (Public) Key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase Service Role Key (for indexing) |

</details>

**4. Run Development Server**

```bash
npm run dev
```

Visit `http://localhost:3000` to start your session.

---

## 🛠️ Tech Stack

<div align="center">

| Component | Technology | Description |
|:---:|:---:|:---|
| **Framework** | **Next.js 16** | App Router, Server Actions, React 19 |
| **UI Library** | **Mantine v8** | Design System, Hooks, Theming |
| **Styling** | **Tailwind CSS** | Utility-first styling with CSS Modules |
| **Database** | **Supabase** | PostgreSQL with pgvector for RAG |
| **AI Model** | **Google Gemini** | Gemini 1.5 Pro for Reasoning |
| **Icons** | **Lucide React** | Consistent, crisp iconography |

</div>

---

## 🤝 Contribution

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

<div align="center">
  <p>
    This project is licensed under the <strong>MIT License</strong>.
  </p>
  <p>
    <em>Generative AI for Education.</em><br>
    <img src="https://visitor-badge.laobi.icu/badge?page_id=yourusername.ai-uni-tutor&style=flat-square&color=00d4ff" alt="Visitor Count">
  </p>
</div>
