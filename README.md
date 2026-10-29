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
    "stripConversation": false
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

在当前目录双击：

```text
install.cmd
```

或执行：

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

## 许可证

MIT


