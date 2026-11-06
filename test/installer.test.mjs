import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const workspace = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]$/, "")
const windowsOnly = { skip: process.platform !== "win32" }

function fixture(run) {
  const prefix = "aggregate-repair 安装-"
  const parent = realpathSync(tmpdir())
  const directory = mkdtempSync(join(parent, prefix))
  try {
    const mock = join(directory, "fake magpie.cmd")
    const log = join(directory, "calls.txt")
    writeFileSync(mock, '@echo off\r\n>>"%INSTALLER_TEST_LOG%" echo %*\r\nexit /b %INSTALLER_TEST_EXIT%\r\n')
    run({ mock, log })
  } finally {
    const target = realpathSync(directory)
    const within = relative(parent, target)
    assert.ok(within && !isAbsolute(within) && !within.startsWith("..") && basename(target).startsWith(prefix))
    rmSync(target, { recursive: true })
  }
}

function launch(entry, mock, log, exitCode = 0) {
  const options = {
    cwd: tmpdir(),
    encoding: "utf8",
    input: "\r\n",
    windowsHide: true,
    timeout: 30_000,
    env: { ...process.env, INSTALLER_TEST_LOG: log, INSTALLER_TEST_EXIT: String(exitCode) },
  }
  if (entry.endsWith(".ps1")) {
    const powershell = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    return spawnSync(powershell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(workspace, entry), "-MagpiePath", mock], options)
  }
  const command = `""${join(workspace, entry)}" -MagpiePath "${mock}""`
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], { ...options, windowsVerbatimArguments: true })
}

test("Windows install entry points install once from their own directory", windowsOnly, () => {
  for (const entry of ["install.cmd", "一键安装.cmd", "install-magpie-plugin.ps1"]) {
    fixture(({ mock, log }) => {
      const result = launch(entry, mock, log)
      assert.equal(result.error, undefined, `${entry}: ${result.error}`)
      assert.equal(result.status, 0, `${entry}: ${result.stdout}\n${result.stderr}`)
      const calls = readFileSync(log, "utf8").trim().split(/\r?\n/)
      assert.equal(calls.length, 1, entry)
      assert.ok(calls[0].startsWith("plugin add "), calls[0])
      assert.ok(calls[0].includes(workspace), calls[0])
    })
  }
})

test("Windows installer returns failure when Magpie rejects installation", windowsOnly, () => {
  fixture(({ mock, log }) => {
    const result = launch("一键安装.cmd", mock, log, 17)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /17/)
    assert.doesNotMatch(result.stdout, /安装成功/)
    assert.equal(readFileSync(log, "utf8").trim().split(/\r?\n/).length, 1)
  })
})
