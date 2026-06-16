# 上游同步记录

本仓库是 `mengxi-ream/read-frog` 的个人 fork，采用选择性同步策略：只合入当前本地工作流需要的上游修复，避免一次性合并上游主线带来的大范围冲突和行为变化。

## 2026-06-16

### 上游基准

- 官方仓库：`https://github.com/mengxi-ream/read-frog`
- 官方观测基准：`a125f673 fix(subtitles): mount subtitle toast at body level (#1698)`
- 当前策略：在官方 `a125f673` 之前选择性同步必要更新；`a125f673` 本身尚未同步。

### 本次选择性同步

- `540b288f fix(language-detection): harden LLM output parsing with JSON prompt and code fence stripping (#1649)`

同步内容：

- 将 LLM 语言检测 prompt 调整为要求返回 JSON。
- 解析模型输出时支持剥离 Markdown code fence。
- 使用 schema 校验 `{ reason?, code }`，无效输出返回 `null`。
- 增加语言检测解析回归测试，覆盖 fenced JSON 和无效输出场景。

### 暂未同步的相邻上游更新

- `a125f673 fix(subtitles): mount subtitle toast at body level (#1698)`
- `4d223f77 feat(subtitles): support YouTube Shorts subtitle translation (#1695)`
- `44237ace fix(youtube-subtitles): recover off-track dialogue in stylized karaoke videos (#1696)`
- `f1d4284b fix(subtitles): only capture pointer events on the YouTube drag handle (#1694)`
- `51e97625 i18n: update and improve zh-TW Traditional Chinese locale`
- `6b08f618 fix(provider-options): match model recommendations case-insensitively (#1682)`
- `80aeb349 feat(subtitles): export translated srt (#1624)`
- `c9b157ad fix(providers): migrate 302 ai configs to custom provider (#1618)`

### 后续同步注意事项

- 字幕相关提交改动面较大，涉及 content script、YouTube DOM 适配、字幕设置 UI 和导出流程，应单独评估。
- Provider 迁移类提交会影响配置 schema 和历史配置迁移，合入前需要重点检查本 fork 的自定义 provider 配置。
- 每次选择性同步应记录官方提交 hash、同步范围、未同步原因和验证命令。
