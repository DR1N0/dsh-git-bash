# @dr1n0/dsh-git-bash

English | [中文](README.zh-CN.md)

> **Community continuation (derived project).** This repository is derived from
> [inmny/dsh-git-bash](https://github.com/inmny/dsh-git-bash) and continues the
> 0.2.x adaptation from [ahtsiu](https://github.com/ahtsiu/dsh-git-bash)'s
> `bugfix/adapt-to-0.2.1-rc.5` branch. The original authors retain all
> copyright; this project is distributed under the same MIT license. The
> package name differs from the original `dsh-plugin-git-bash`, so both can be
> installed side by side. The original design, native guard, and test matrix
> come from upstream.

Use Git for Windows Bash as the default shell for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) on Windows
while keeping DSH's `read-only`, `workspace-write`, and `danger-full-access`
permission semantics.

![Git Bash running inside DeepSeek Harness](assets/teaser.png)

## What differs from upstream

Relative to upstream `dsh-plugin-git-bash` (last published 0.3.3) and this
continuation's first batch of changes:

- **Package name**: `@dr1n0/dsh-git-bash`, so it does not collide with the
  original package on npm.
- **Versioning**: `<DSH version line>-r<plugin revision>`, e.g. `0.2.2-r1` is
  the first plugin build for the DSH 0.2.2 line.
- **DSH 0.2.x adaptation**: follows the `execute` seam, Config schema
  projection, and the new client module injection (from ahtsiu's branch).
- **UTF-8 output**: pins `LANG`/`LC_ALL`/`PYTHONUTF8`/`PYTHONIOENCODING` for Git
  Bash so CJK output does not turn into mojibake or raise
  `UnicodeEncodeError` on GBK code pages.
- **MSYS path translation**: `/d/work` and `/cygdrive/d/work` from models or
  host code become `D:\work` before Node uses them as a working directory;
  non-drive paths such as `/usr/bin` stay untouched.
- **Host-level call routing**: `ctx.shell` calls without a `sandboxPolicy`
  (host plugin internals) no longer inherit the deployment sandbox gate and
  run on Windows PowerShell by default; set `hostShell: bash` to keep them on
  Git Bash.
- **Release scripts**: `prepack` only compiles TypeScript, so publishing does
  not require MSVC; prebuilt native artifacts ship in the package.

## Versioning

A version looks like `0.2.2-r1`:

- `0.2.2`: the DSH version line (`engines.dsh: ">=0.2.2-rc.1"`);
- `-r1`: the N-th plugin revision. Plugin patches on the same DSH line bump
  `-r2`, `-r3`, and never collide with future DSH version numbers.

Compatibility is decided only by the `engines.dsh` lower bound: a new plugin
build accepts every later DSH release, so the package does not need a new
release on each DSH upgrade; users on an older DSH install the matching older
plugin version.

## Usage

Once installed into a profile, the `standard`, `code`, `cordis`, and `minimal`
presets use Git Bash instead of PowerShell. Foreground commands, background
commands, and Web Agent presets share the same executor.

To confirm the shell in a new session:

```sh
printf 'shell=%s\nversion=%s\nmsystem=%s\n' "$BASH" "$BASH_VERSION" "$MSYSTEM"
```

`MSYSTEM` should be `MINGW64`, `MINGW32`, or `UCRT64` (UCRT64 is the default
since Git for Windows 2.56).

In the Web UI the Bash tool row expands to command, cwd, stdout/stderr, and
exit status. Nested Bash calls inside `run_code` use the same terminal details;
long commands wrap automatically, while output keeps horizontal scrolling so
logs and tables stay aligned.

The plugin installs as a bundle layer in the target profile and never modifies
the DSH installation directory.

## Install or update

Install a pinned version from npm into the Web profile:

```sh
dsh plugin --profile web add @dr1n0/dsh-git-bash@0.2.2-r2
```

Use the same command to update. Restart `dsh web` afterwards so the Host and
the browser client both load the new version, then start a new session.

For a local checkout:

```powershell
dsh plugin --profile web add E:\Coding\dsh-git-bash
```

## Permission modes

### `read-only` and `workspace-write`

Restricted commands are still started through DSH's Windows ACL sandbox, which
creates a `WRITE_RESTRICTED` token. Inside the sandbox the plugin runs the
native guard first, and the guard starts Git Bash:

```text
DSH ACL runner -> msys-token-guard.exe -> bash.exe -> child processes
```

- `read-only` can start Git Bash but cannot write the workspace.
- `workspace-write` can only write the DSH-authorized workspace and private temp.

### `danger-full-access`

This mode skips the native guard and runs Git Bash directly, matching how the
0.1.x plugin executed commands.

## Configure the Git Bash path

The plugin auto-detects Git Bash under Program Files, per-user installs, and
Scoop. In the Web GUI open **Plugins**, then this plugin's `git-bash-shell`
configuration page you can type the `bash.exe` path or use **Select Git
installation folder** to open the system directory picker. Saved changes apply
to later Bash commands immediately; resetting restores the profile
configuration or auto-detection.

Without the GUI, set `DSH_GIT_BASH_PATH` before starting DSH:

```powershell
$env:DSH_GIT_BASH_PATH = 'D:\Apps\Git\bin\bash.exe'
dsh web
```

You can also configure `executable` for the provider in the profile's
`cordis.patch.yml`:

```yaml
- id: git-bash-shell
  name: '@dr1n0/dsh-git-bash'
  config:
    executable: D:\Apps\Git\bin\bash.exe
```

## Configure the host-level shell

Some host plugins call `ctx.shell` without a sandbox policy. Those calls run on
Windows PowerShell by default because they are usually written for the
platform's default shell:

```yaml
- id: git-bash-shell
  name: '@dr1n0/dsh-git-bash'
  config:
    hostShell: pwsh   # default; set to bash to keep every host call on Git Bash
```

| Value | Behavior |
| --- | --- |
| `pwsh` (default) | Host `ctx.shell` calls use `pwsh.exe` (falling back to Windows PowerShell 5.1 when PowerShell 7 is missing), outside the sandbox |
| `bash` | Host calls also run through Git Bash, outside the sandbox |

Tool calls that carry a `sandboxPolicy` are unaffected: they always use Git
Bash with the selected permission mode.

## Sidebar terminal

The right-sidebar terminal lists shells from `terminalController.config.shellCandidates`
(default `zsh`, `bash`, `fish`, `pwsh`, `powershell`, `cmd`) and resolves each
name through PATH. Git for Windows does not put its `bin` directory on PATH, so
`bash` does not resolve and Git Bash never appears in the menu.

Override the terminal controller in the profile's `cordis.patch.yml` to add it
back:

```yaml
- id: terminal-controller
  config:
    shellCandidates:
      - 'C:\Program Files\Git\bin\bash.exe'
      - bash
      - pwsh
      - powershell
      - cmd
```

Restart DSH and the sidebar's new-terminal menu offers Git Bash.

## Platform support

Runtime requirements:

- Windows x64
- Node.js 24 or newer
- DSH 0.2.2 line (`0.2.2-rc.1` and later; DSH 0.2.3 needs a new plugin build)
- Git for Windows x64

The npm package ships prebuilt `msys-token-guard.exe` and
`msys-token-guard-hook.dll`, so a normal install needs neither Visual Studio
nor CMake. The native guard currently supports `win32-x64` only; other
architectures get `SANDBOX_UNAVAILABLE` in restricted modes instead of an
unconfined fallback.

Microsoft Detours 4.0.1 sources live under `native/vendor/detours` with their
license text shipped in the package. Detours passes DLL paths through the
Windows ANSI API, so the plugin installation path must be losslessly
representable in the current system code page and stay within `MAX_PATH`;
otherwise the guard fails closed.

## Verification and compatibility

Validated on Windows 11, Git for Windows 2.56.0 (UCRT64 runtime, bash 5.3.15),
DSH 0.2.2-rc.1. All 36 `pnpm test` cases pass, including the real ACL
permission matrix for `read-only` / `workspace-write` and the native guard's
fail-closed cases.

Restricted modes fail on Git for Windows 2.52 (MINGW64, bash 5.2):

```text
cygheap_user::init: NtSetInformationToken (TokenDefaultDacl), 0xC0000022
fatal error - couldn't create signal pipe, Win32 error 5
```

MSYS rewrites its own token default DACL during initialization and the ACL
sandbox rejects it; the native guard's hook did not intercept that rewrite on
that Git version. Upgrading to 2.56 made the failure disappear (the same test
suite is green); `danger-full-access` is unaffected on 2.52.

## Development

Install dependencies and run the full verification:

```sh
pnpm install
pnpm test        # full build (including native) + all tests
pnpm build:ts    # TypeScript only (publish path; no MSVC required)
pnpm run pack:check
```

Rebuilding native artifacts on Windows needs Visual Studio C++ Build Tools and
CMake 3.25 or newer. `pnpm test` builds the native guard with C++20, static MSVC
runtime, CFG, CET, ASLR, and NX, then runs the Windows ACL permission matrix,
fail-closed, Web client, and package metadata tests.

Non-Windows hosts do not cross-compile the native guard; they only verify that
the prebuilt artifacts exist. From an MSYS shell such as Git Bash, two
fork/pipe-sensitive ACL cases are skipped because MSYS rewrites the parent
process token; run the suite from PowerShell, cmd, or CI for the full matrix.

## License

MIT. Original copyright belongs to the authors of
[inmny/dsh-git-bash](https://github.com/inmny/dsh-git-bash); the 0.2.x
adaptation comes from [ahtsiu](https://github.com/ahtsiu/dsh-git-bash).
