# Read Frog 个人修改版

这是我基于上游项目 [mengxi-ream/read-frog](https://github.com/mengxi-ream/read-frog) 维护的个人 fork，主要用于本地 Chrome 扩展加载和个人阅读工作流优化。

本仓库保留 Read Frog 原有的网页翻译、划词工具栏、词典、朗读、AI 服务商配置等能力，并在此基础上加入了快捷键录制、沉浸式阅读侧键拦截和本地生词本等改动。

## 本阶段修改内容

### 节点翻译快捷键录制

- 段落/节点翻译快捷键支持键盘单键录制，例如 `A`、`1`、`F8`、`Space`、`/`。
- 支持录制鼠标侧键：`mouseButton4` 和 `mouseButton5`。
- Options 和 Popup 复用同一个快捷键录制控件。
- 录制时支持 `Escape` 取消。
- 保留原有键盘快捷键“松开触发，长按 1 秒自动触发”的行为。

### 沉浸式阅读

- 网页悬浮窗新增“沉浸式阅读”开关。
- 开关按当前网站保存，例如 `docs.pytorch.org`。
- 开启后拦截鼠标侧键，避免 Chrome 触发前进/后退。
- 关闭后不接管鼠标侧键，完全交还给 Chrome。
- 如果鼠标侧键同时被设置为翻译快捷键，则只有在沉浸式阅读开启时触发悬停段落翻译。

### 本地生词本

- 划词工具栏中的词典结果弹窗新增星标按钮。
- 点亮星标后将当前词条加入本地生词本，再次点击可取消收藏。
- 生词本支持查看、搜索、删除和展开详情卡片。
- 生词详情可展示较长上下文，解决表格中内容被截断的问题。
- 生词本入口移动到网页悬浮窗“设置”按钮下方，更贴近日常阅读入口。
- 生词数据最终落到 Dexie 的 `vocabularyEntries` 表，并支持从旧的 `browser.storage.local` 数据自动迁移。

## 当前验证状态

最近一次推送前验证：

```bash
SKIP_FREE_API=true corepack pnpm exec nx test -- --exclude="**/free-api.test.ts"
corepack pnpm type-check
corepack pnpm lint
```

结果：

```text
147 files / 1275 tests passed
type-check passed
lint passed
```

Chrome 扩展加载目录：

```text
.output/chrome-mv3
```

Chrome zip 包：

```text
.output/read-frogextension-1.34.0-chrome.zip
```

## 近期提交

```text
af1f6fc test: stabilize vitest timeout
5b0542a refactor: consolidate vocabulary storage and hotkey cleanup
aca36da feat: add immersive reading and vocabulary notebook
```

## 使用说明

本 fork 主要面向个人本地使用：

1. 安装依赖：

```bash
corepack pnpm install
```

2. 构建 Chrome MV3 扩展：

```bash
WXT_SKIP_ENV_VALIDATION=true corepack pnpm build
```

3. 打包 zip：

```bash
WXT_SKIP_ENV_VALIDATION=true corepack pnpm zip
```

4. 在 Chrome 中加载：

```text
chrome://extensions
```

开启“开发者模式”，选择“加载已解压的扩展程序”，加载：

```text
.output/chrome-mv3
```

## 上游项目

原项目地址：

```text
https://github.com/mengxi-ream/read-frog
```

本 README 记录的是当前 fork 的个人修改内容，不代表上游项目已合并这些功能。
