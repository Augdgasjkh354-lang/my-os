# my-os

个人专属AI操作系统。前端纯静态部署在GitHub Pages，所有数据存浏览器IndexedDB（不上传任何云）。

## 架构

```
[前端SPA] ──► [Cloudflare Worker代理] ──► [外部API]
     │
     ▼
[IndexedDB 浏览器本地]
```

- 前端：单页HTML应用，原生ES2020+，无构建工具，无npm依赖
- 后端：无。Cloudflare Worker（独立仓库 my-os-proxy）只做透传代理
- 存储：100% IndexedDB，绝不上传服务器
- AI对话使用SSE流式

## 安全规则（最高优先级）

1. **绝不**把 Access Token、API Key、Worker URL 硬编码到任何被git追踪的文件
1. 敏感配置只能通过”设置页”输入，存IndexedDB的 `settings` store
1. 文档/示例中使用占位符如 `<填写你的Token>`，不要写真实值
1. 即使临时测试代码也不许写真实密钥

## 代理路由约定

所有外部API必须经Worker代理。请求头必须带 `X-Access-Token`。

URL结构：`{WORKER_URL}/{provider}/{原始路径}`

provider 标识（Worker端已映射，前端直接用）：

- `openweather` → OpenWeatherMap
- `goldapi` → GoldAPI.io
- `newsapi` → NewsAPI
- `exchangerate` → ExchangeRate-API
- `deepseek` → DeepSeek
- `glm` → 智谱（base: open.bigmodel.cn）
- `qwen` → Qwen（通义千问）

示例：`${workerUrl}/openweather/data/2.5/weather?q=Beijing&appid=${owmKey}` + header `X-Access-Token: ${accessToken}`

## IndexedDB Schema

数据库名 `my-os`。Object stores（阶段1全部建好结构，先只用settings）：

- `settings` (keyPath: ‘key’) — 配置（API Keys、城市、Worker URL、Access Token等）
- `memories` (keyPath: ‘id’, autoIncrement) — 长期记忆，阶段2实现
- `tasks` (keyPath: ‘id’, autoIncrement) — 任务，阶段3实现
- `reports` (keyPath: ‘date’) — 每日晨报，阶段2实现
- `conversations` (keyPath: ‘id’, autoIncrement) — Agent对话，阶段3实现

`db.js` 必须封装：`getSetting(key)`、`setSetting(key, value)`、`getAllSettings()`、`exportAll()`、`importAll(json)`

## UI风格

- 暗色基底：背景 `#0a0a0a`，卡片 `#1a1a1a`，边框 `#2a2a2a`
- 文字：主 `#e8e8e8`，次 `#999`，禁用 `#555`
- 强调色单一：`#4a9eff`（青蓝）
- 字体：`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- 圆角 8px，无阴影，极简
- 全站简体中文
- 所有交互必须有即时反馈：loading、success、error 状态明确

## 文件组织

```
my-os/
├── index.html         入口（单SPA）
├── css/main.css
├── js/
│   ├── app.js         主入口、路由、初始化
│   ├── db.js          IndexedDB封装
│   ├── api.js         代理API调用封装
│   ├── stream.js      SSE流式消费工具
│   ├── settings.js    设置页
│   ├── ui.js          通用UI工具（toast、modal、loading）
│   └── [后续阶段]     memory.js、tasks.js、agent.js、report.js
├── AGENTS.md
└── README.md
```

## 编码约定

- 原生ES2020+，不引任何依赖
- **路径全部相对**（`./css/main.css`）——GitHub Pages在子路径部署，不用绝对路径
- 注释中文，函数 camelCase，常量 UPPER_SNAKE
- 每个 `await` 必须有 try-catch 或明确的上层错误处理
- 函数短而单一职责
- 仅顶层 `window.app` 命名空间，避免全局污染

## 部署

- main分支 = 生产，GitHub Pages源：main分支根目录
- 推送即部署，无构建步骤
- URL：`https://<用户名>.github.io/my-os/`

## Codex工作流约束

- 不要自行启动 dev server / npm 命令——本项目没有
- 修改时不破坏已有功能
- commit message 用中文简洁说明
- 阶段性大改动单commit，不要每个小改都commit

## 路由约定

Hash路由，三个主路由：#/report、#/memory、#/settings。js/router.js管理切换。无hash默认到#/report。

## CDN例外

唯一允许的CDN脚本：marked.js（markdown渲染）。引入方式 <script src="https://cdn.jsdelivr.net/npm/marked@latest/marked.min.js"></script>。其他任何外部脚本/库需重新讨论。

## 晨报生成时机

每日首次进入#/report时自动检查并生成。同一天反复进入只读取缓存。“重新生成”按钮可强制覆盖。

## Worker代理特例

- goldapi的key使用 X-Goldapi-Token 头（避免与Worker自身的X-Access-Token冲突）
- Worker端会自动把它改名为上游期望的x-access-token

## Agent系统

- 应用启动检查 agents store，空则写入3个种子agent（分析师/写手/速查）
- is_seed=true 的agent允许编辑但不可删除
- 每个agent绑定 provider、model、system_prompt、thinking_default、icon、color

## 对话流程

- 一个 conversation 关联一个起始 agent，但允许会话中切换
- 切换后的消息使用新agent的system_prompt和model
- 流式必须用 stream.js consumeSSE
- assistant消息的thinking_content单独存储，UI区分展示

## Provider思考模式映射

- DeepSeek：通过model切换（v4-pro=思考开，v4-flash=思考关），body无额外参数
- GLM：同model glm-5.1，body加 thinking:{type:‘enabled’|‘disabled’}
- Qwen：同一model，body加 enable_thinking:true/false 控制。Chat模式用qwen3.5-flash，Thinking模式用qwen3-max。

## 对话标题自动生成

首条assistant消息完成后，异步调用速查Agent，prompt: “用10字内简体中文概括以下用户问题作为对话标题，仅输出标题，无需引号或标点：{首条用户消息}”

## 诊断系统

- js/logger.js 管理内存日志（最近100条，不持久化）
- 所有 api.js / stream.js / db.js / report.js 的错误必须调用对应 logError()
- 对话页「🔍」按钮触发诊断：把最近30条日志作为context发给当前agent
- logger.js 的 formatLogsForAI() 是日志→AI的标准接口，不要绕过它
