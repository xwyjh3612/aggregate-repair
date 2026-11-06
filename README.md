# aggregate-repair

Magpie 图形化中间件，用于处理**切换上游渠道后，同一会话中的 Responses 对象失效并导致 400**的问题。

常见错误：

```text
The requested item was created under a different Azure OpenAI resource.
Use the same resource that created the item to access it.
```

## 解决方式

插件在 Magpie 内运行，不修改 Codex 和 PPBind 配置。

```text
Codex → PPBind → Magpie → 上游渠道
```

安装后：

```text
Codex → PPBind → Magpie(middleware) → 上游渠道
```

## 图形设置

插件启用后，左侧“插件”分组会出现：

```text
渠道会话修复
```

设置页可以修改：

- 是否启用
- 渠道范围
- 模型范围
- 安全模式
- 是否移除无法恢复的引用项
- 是否允许移除上一轮响应指针
- 是否允许移除会话指针

点击“保存设置”后，下一次请求生效。

## 默认配置

```json
{
  "middleware": {
    "enabled": true,
    "providers": ["*"],
    "models": [],
    "mode": "safe",
    "dropItemReferences": false,
    "stripPreviousResponseId": false,
    "stripConversation": false,
    "rotateSessionOnChange": true
  }
}
```

## 字段说明

### 渠道范围

留空或填 `*` 表示所有 Responses 渠道。也可以填写具体渠道 ID 或通配符：

```json
["relay-main", "relay-*"]
```

### 模型范围

留空表示不限模型：

```json
["deepseek/*", "gpt-*"]
```

### 安全模式

- `safe`：默认；不会删除会话指针
- `aggressive`：仅在显式允许时删除无法恢复的引用

### 清理项

- `dropItemReferences`：删除无法还原的引用项，默认关闭
- `stripPreviousResponseId`：删除上一轮响应指针，默认关闭
- `stripConversation`：删除会话指针，默认关闭

默认只删除 `input[]` 每一项顶层的 `id`，不会删除：

- `content`
- `role`
- `encrypted_content`
- `summary`
- `call_id`
- `arguments`
- 工具调用和工具输出

## 安装

从 npm 安装：

```powershell
magpie plugin add npm:magpie-aggregate-repair
```

也可以直接从 GitHub 安装：

```powershell
magpie plugin add github:xwyjh3612/aggregate-repair
```

安装后，在 Magpie 的插件设置中启用“渠道会话修复”。

如果已克隆源码，可以在仓库目录双击：

```text
install.cmd
```

或在仓库目录执行：

```powershell
magpie plugin add .
```

## 注意

切换渠道时，会话对象的归属资源可能发生变化。插件只移除用于跨资源引用的对象 ID，不会删除正常聊天正文和加密推理内容。

如果上游必须依赖会话指针才能恢复历史，请不要开启：

```json
{
  "stripPreviousResponseId": true
}
```

除非同时具备完整历史重放能力，否则删除会话指针会丢上下文。

## 开发

```powershell
npm run check
npm test
npm pack --dry-run
```

## 发布

包发布到 npm 后，可以用上面的 npm 命令安装。发布前会自动执行语法检查和测试：

```powershell
npm login --registry=https://registry.npmjs.org
npm publish
```

后续更新先提升 `package.json` 中的版本号，再提交代码并发布；npm 不允许重复发布同一个版本。

公开 GitHub 仓库添加 `magpie-plugin` topic 后，会显示在 Magpie 的“插件 → 发现 → Unofficial, on GitHub”区域。详情见 [Magpie 插件发布文档](https://usemagpie.ai/docs/plugins)。

## 许可证

MIT

## 409 会话绑定

当请求中带有渠道或模型信息时，插件会按“渠道 + 模型”派生稳定的上游会话 ID。同一渠道/模型保持连续，切换渠道或模型后自动使用新的会话 ID，避免旧绑定继续返回 409。
