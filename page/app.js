(async () => {
  await magpie.ready

  const $ = (id) => document.getElementById(id)
  const splitList = (value) => value.split(/[,\n]/u).map((item) => item.trim()).filter(Boolean)
  const lines = (value) => Array.isArray(value) ? value.join("\n") : ""
  const current = await magpie.options.get()
  const mw = current.middleware && typeof current.middleware === "object" ? current.middleware : {}
  const currentProviders = Array.isArray(mw.providers) ? mw.providers : []
  const allSelected = currentProviders.length === 0 || currentProviders.includes("*")

  let providers = []
  try {
    providers = await magpie.read("providers:list")
    $("providerHint").textContent = providers.length ? "点击渠道名称可以缩小生效范围。" : "Magpie 当前没有可列出的渠道。"
  } catch {
    $("providerHint").textContent = "读取渠道列表失败；将使用所有 Responses 渠道。"
  }

  $("allProviders").checked = allSelected
  const list = $("providerList")
  for (const provider of providers) {
    const label = document.createElement("label")
    label.className = "check-row compact"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.dataset.providerId = provider.id
    input.checked = allSelected || currentProviders.includes(provider.id)
    input.disabled = allSelected
    const text = document.createElement("span")
    const name = document.createElement("b")
    name.textContent = provider.name || provider.id
    const id = document.createElement("small")
    id.textContent = provider.id
    text.append(name, id)
    label.append(input, text)
    list.append(label)
  }
  if (!providers.length) {
    const empty = document.createElement("p")
    empty.className = "provider-empty"
    empty.textContent = "没有可列出的渠道，将覆盖所有 Responses 渠道。"
    list.append(empty)
  }

  $("allProviders").addEventListener("change", () => {
    const all = $("allProviders").checked
    list.querySelectorAll("input[data-provider-id]").forEach((input) => {
      input.disabled = all
      if (all) input.checked = true
    })
  })

  $("enabled").checked = mw.enabled !== false
  $("models").value = lines(mw.models ?? [])
  $("mode").value = mw.mode === "aggressive" ? "aggressive" : "safe"
  $("dropItemReferences").checked = mw.dropItemReferences === true
  $("stripPreviousResponseId").checked = mw.stripPreviousResponseId === true
  $("stripConversation").checked = mw.stripConversation === true

  const paintSummary = () => {
    const removals = ["input[] 顶层资源 ID"]
    if ($("dropItemReferences").checked) removals.push("无法恢复的引用项")
    if ($("stripPreviousResponseId").checked) removals.push("上一轮响应指针")
    if ($("stripConversation").checked) removals.push("会话指针")
    $("summaryText").textContent = "当前会移除：" + removals.join("、") + "。"
  }
  document.querySelectorAll("input, select").forEach((el) => el.addEventListener("change", paintSummary))
  paintSummary()

  $("save").addEventListener("click", async () => {
    const status = $("status")
    const button = $("save")
    button.disabled = true
    status.textContent = "正在保存…"
    try {
      const all = $("allProviders").checked
      const selectedProviders = all
        ? ["*"]
        : Array.from(list.querySelectorAll("input[data-provider-id]:checked")).map((input) => input.dataset.providerId)
      const next = {
        ...current,
        middleware: {
          enabled: $("enabled").checked,
          providers: selectedProviders,
          models: splitList($("models").value),
          mode: $("mode").value,
          dropItemReferences: $("dropItemReferences").checked,
          stripPreviousResponseId: $("stripPreviousResponseId").checked,
          stripConversation: $("stripConversation").checked,
        },
      }
      const saved = await magpie.options.set(next)
      Object.assign(current, saved)
      status.textContent = "已保存，下一次请求生效"
    } catch (error) {
      status.textContent = "保存失败：" + (error?.message || error)
    } finally {
      button.disabled = false
    }
  })
})()
