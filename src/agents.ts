import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type {} from "@deepseek-ai/dsh-system-prompt";
import type {} from "@deepseek-ai/dsh-tools";

export const name = "git-bash-agent-shell";
export const inject = ["agents", "tools", "systemPrompt"];

// Make the global Git Bash-backed Bash tool win over preset-provided shells.
export function apply(ctx: Context): void {
  const installed = new Map<Agent, () => unknown>();
  // Agents whose install waits for `tool-bash` to register the global `bash` tool.
  const waiting = new Map<Agent, () => void>();

  const installInto = (agent: Agent): void => {
    const globalBash = ctx.tools.get("bash");
    if (globalBash === undefined) return;

    let cleanup!: () => unknown;
    cleanup = agent.ctx.effect(() => {
      const disposers: Array<() => unknown> = [];
      disposers.push(agent.ctx.tools.register(globalBash));

      if (ctx.tools.get("pwsh", agent)) {
        disposers.push(agent.ctx.tools.restrict({ deny: ["pwsh"] }));
      }

      disposers.push(agent.ctx.systemPrompt.section({
        name: "tool:bash",
        order: 105,
        text: "Check the [exit code: N] marker on every Git Bash result; investigate failures before moving on.",
      }));
      disposers.push(agent.ctx.systemPrompt.section({
        name: "tool:pwsh",
        order: 105,
        text: "",
      }));

      return () => {
        for (const dispose of disposers.reverse()) dispose();
        if (installed.get(agent) === cleanup) installed.delete(agent);
      };
    }, "git-bash-agent-shell.install()");

    installed.set(agent, cleanup);
  };

  // `tool-bash` registers its global `bash` tool only after its `jobs`
  // dependency resolves, which can land after this agent is created. Wait for
  // the tool instead of failing the whole plugin row.
  const install = (agent: Agent): void => {
    if (installed.has(agent) || waiting.has(agent)) return;

    if (ctx.tools.get("bash") !== undefined) {
      installInto(agent);
      return;
    }

    const stop = ctx.on("tools/change", () => {
      if (ctx.tools.get("bash") === undefined) return;
      stop();
      waiting.delete(agent);
      if (!installed.has(agent)) installInto(agent);
    });
    waiting.set(agent, stop);
  };

  const uninstall = (agent: Agent): void => {
    installed.delete(agent);
    const stop = waiting.get(agent);
    if (stop !== undefined) {
      stop();
      waiting.delete(agent);
    }
  };

  ctx.effect(() => {
    const stopCreated = ctx.on("agent/created", ({ agent }) => {
      install(agent);
      return undefined;
    });
    const stopDisposed = ctx.on("agent/disposed", ({ agent }) => uninstall(agent));
    for (const agent of ctx.agents.list()) install(agent);

    return async () => {
      stopCreated();
      stopDisposed();
      for (const stop of waiting.values()) stop();
      waiting.clear();
      const cleanups = [...installed.values()];
      installed.clear();
      await Promise.allSettled(cleanups.map((cleanup) => Promise.resolve(cleanup())));
    };
  }, "git-bash-agent-shell.lifecycle()");
}
