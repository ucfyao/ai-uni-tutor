<!-- Top Anchor -->
<a name="readme-top"></a>

<!-- Project Header -->
<div align="center">
  <br />
  <img src="../public/assets/logo.png" alt="AI Uni Tutor Logo" width="150" style="border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
  <br />
  <br />

  <h1 align="center" style="font-size: 3rem; font-weight: 800; letter-spacing: -1px;">AI Uni Tutor 🎓</h1>

  <p align="center" style="font-size: 1.2rem; color: #666; max-width: 600px;">
    <strong>规模化大学教育的 AI 副驾驶</strong>
  </p>

  <p align="center">
    > <strong>AI Uni Tutor</strong> 是一款 AI 驱动的学术副驾驶，旨在帮助大学生<strong>更好地学习，而不是更快地作弊</strong>。<br>
    > 它结合了 <strong>LLM 推理</strong>、<strong>课程特定的 RAG</strong> 以及<strong>符合教育学的辅导模式</strong>，提供个性化、合乎道德且可扩展的教育支持。
  </p>

  <p align="center">
    <a href="#getting-started"><strong>🚀 快速开始</strong></a>
    ·
    <a href="../../README.md"><strong>🇺🇸 English</strong></a>
    ·
    <a href="#contributing">报告 Bug</a>
  </p>
</div>

<!-- Badges -->
<div align="center">

![Next.js](https://img.shields.io/badge/next.js-%23000000.svg?style=for-the-badge&logo=next.js&logoColor=white)
![Mantine](https://img.shields.io/badge/Mantine-339AF0?style=for-the-badge&logo=mantine&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)

</div>

<br />

---

### AI Uni Tutor 是什么
- 一个**感知课程内容的 AI 导师**
- 一个**学习伙伴**，而不仅仅是答案生成器
- 一个**综合平台**，而非单一模型的简单包装

### 适用人群
- 🎓 大学生 (首发适配理工科 STEM，后续扩展)
- 🧑‍🏫 教育工作者与教学团队
- 🏫 探索 AI 辅助教学的院校机构

---

## 💎 核心功能

### 🧠 符合教育学的辅导模式
每一次交互都明确针对特定的**学习意图**设计：

- **讲座助手 (Lecture Helper)**  
  → 通过类比、分步推理和苏格拉底式提问来解释概念
- **作业教练 (Assignment Coach)**  
  → 引导思考、调试代码和构建结构，**绝不直接提供最终答案**
- **备考特训 (Exam Prep)**  
  → 生成模拟题，识别知识薄弱点，并还原真实考试场景

> 🔒 旨在**减少作弊动机**，而非助长作弊。

### 📚 上下文感知 (RAG)
• **课程检索**: 上传教材、幻灯片和论文。AI 利用 **Supabase Vector Search** 检索你的特定课程资料，确保每一个回答都有据可依。<br>
• **引用追踪**: 回答由源文件支持，确保学术准确性。

### 💎 "Pro Max" UI/UX
• **现代美学**: 干净的玻璃拟态界面，深邃的弥散投影，统一的 **Indigo-Violet** 渐变品牌色。<br>
• **流畅交互**: 由 Mantine v8 驱动的悬浮卡片、磁性按钮和丝滑布局过渡。

---

## 🚀 快速开始

### 前置要求

*   **Node.js**: v18+
*   **Supabase 项目**: 需启用 Vector 扩展
*   **Google AI Studio Key**: 用于访问 Gemini Pro 模型

### 📦 安装步骤

**1. 克隆仓库**

```bash
git clone https://github.com/yourusername/ai-uni-tutor.git
cd ai-uni-tutor
```

**2. 安装依赖**

```bash
npm install
```

**3. 配置环境变量**

在根目录创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

<details>
<summary>📋 <b>环境变量参考</b></summary>

| 变量名 | 必填 | 描述 |
|:---|:---:|:---|
| `GEMINI_API_KEY` | **是** | 您的 Google Gemini API Key |
| `SUPABASE_URL` | **是** | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | **是** | Supabase Anon Key（仅服务端） |
| `SUPABASE_SERVICE_ROLE_KEY` | **是** | Supabase Service Role Key (用于索引) |

</details>

**4. 运行开发服务器**

```bash
npm run dev
```

访问 `http://localhost:3000` 开始体验。

---

## 🛠️ 技术栈

<div align="center">

| 组件 | 技术 | 描述 |
|:---:|:---:|:---|
| **框架** | **Next.js 16** | App Router, Server Actions, React 19 |
| **UI 库** | **Mantine v8** | 设计系统, Hooks, Theming |
| **样式** | **Tailwind CSS** | CSS Modules utility 优先样式 |
| **数据库** | **Supabase** | PostgreSQL + pgvector (RAG) |
| **AI 模型** | **Google Gemini** | Gemini 1.5 Pro 推理 |
| **图标** | **Lucide React** | 统一、清晰的图标库 |

</div>

---

## 🤝 贡献指南

我们欢迎贡献！详情请参阅我们的 [贡献指南](../../CONTRIBUTING.md)。

1.  Fork 本项目
2.  创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  提交 Pull Request

---

<div align="center">
  <p>
    本项目基于 <strong>MIT 许可证</strong> 开源。
  </p>
  <p>
    <em>Generative AI for Education.</em><br>
    <img src="https://visitor-badge.laobi.icu/badge?page_id=yourusername.ai-uni-tutor&style=flat-square&color=00d4ff" alt="Visitor Count">
  </p>
</div>
